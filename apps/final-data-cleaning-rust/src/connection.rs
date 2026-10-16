use std::{
  collections::{HashMap, HashSet},
  sync::Arc,
  time::Duration,
};

use anyhow::{bail, Context, Result};
use tokio::{
  sync::{mpsc, watch},
  time::{self, MissedTickBehavior},
};
use tokio_stream::wrappers::ReceiverStream;
use tonic::transport::{ClientTlsConfig, Endpoint};

use crate::{
  node::Node,
  proto::{
    master_frame, node_control_service_client::NodeControlServiceClient, node_frame, NodeFrame,
    NodeLogBatch, NodeLogEntry, ProgressUpdate,
  },
};

const SEND_TIMEOUT: Duration = Duration::from_secs(5);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const MIN_RECONNECT: Duration = Duration::from_secs(1);
const MAX_RECONNECT: Duration = Duration::from_secs(30);

/// Keep a bounded, outgoing gRPC connection alive until graceful shutdown.
pub async fn run(node: Arc<Node>, mut shutdown: watch::Receiver<bool>) {
  let mut reconnect = MIN_RECONNECT;
  let mut pending_logs = Vec::new();
  while !is_stopping(&shutdown) {
    node.set_link("connecting", "");
    let mut accepted = false;
    match connect_once(&node, &mut shutdown, &mut accepted, &mut pending_logs).await {
      Ok(()) => break,
      Err(error) if !is_stopping(&shutdown) => {
        let message = error.to_string();
        node.set_link("disconnected", &message);
        node.log("warn", &format!("与总服务连接断开：{message}"));
      }
      Err(_) => break,
    }
    if accepted {
      reconnect = MIN_RECONNECT;
    }
    tokio::select! {
        _ = cancelled(&mut shutdown) => break,
        _ = time::sleep(reconnect) => {}
    }
    reconnect = (reconnect * 2).min(MAX_RECONNECT);
  }
  node.set_link("disconnected", "服务已停止");
}

async fn connect_once(
  node: &Arc<Node>,
  shutdown: &mut watch::Receiver<bool>,
  accepted: &mut bool,
  pending_logs: &mut Vec<NodeLogEntry>,
) -> Result<()> {
  let mut endpoint = Endpoint::from_shared(node.config.master_url.clone())
    .context("总服务地址无效")?
    .connect_timeout(CONNECT_TIMEOUT)
    .http2_keep_alive_interval(Duration::from_secs(20))
    .keep_alive_timeout(Duration::from_secs(10))
    .keep_alive_while_idle(true);
  if node.config.master_url.starts_with("https://") {
    endpoint = endpoint
      .tls_config(ClientTlsConfig::new().with_enabled_roots())
      .context("总服务 TLS 配置无效")?;
  }
  let channel = tokio::select! {
      _ = cancelled(shutdown) => return Ok(()),
      result = time::timeout(CONNECT_TIMEOUT, endpoint.connect()) => {
          result.context("连接总服务超时")?.context("无法连接总服务")?
      }
  };
  let mut client = NodeControlServiceClient::new(channel);
  let (sender, receiver) = mpsc::channel(128);
  // Queue registration before starting the RPC: some servers wait for the
  // first request frame before returning their streaming response headers.
  send_frame(
    &sender,
    shutdown,
    NodeFrame {
      payload: Some(node_frame::Payload::Register(node.register(true))),
    },
  )
  .await?;
  let response = tokio::select! {
      _ = cancelled(shutdown) => return Ok(()),
      result = time::timeout(CONNECT_TIMEOUT, client.connect(ReceiverStream::new(receiver))) => {
          result.context("建立总服务双向流超时")?.context("无法建立总服务双向流")?
      }
  };
  let mut stream = response.into_inner();
  let mut heartbeat = time::interval(node.config.heartbeat);
  let mut logs = time::interval(node.config.log_flush);
  heartbeat.set_missed_tick_behavior(MissedTickBehavior::Skip);
  logs.set_missed_tick_behavior(MissedTickBehavior::Skip);
  // interval() ticks immediately; registration was already sent above.
  heartbeat.tick().await;
  logs.tick().await;
  let ack_deadline = time::Instant::now() + CONNECT_TIMEOUT;
  let mut last_sent = HashMap::new();
  let mut advertised_unavailable = false;
  loop {
    let mut send_progress_now = false;
    tokio::select! {
        _ = cancelled(shutdown) => return Ok(()),
        _ = time::sleep_until(ack_deadline), if !*accepted => bail!("总服务未确认节点注册"),
        frame = stream.message() => {
            let Some(frame) = frame.context("总服务双向流异常")? else {
                bail!("总服务已关闭双向流");
            };
            match frame.payload {
                Some(master_frame::Payload::Ack(ack)) => {
                    if !ack.accepted {
                        bail!("总服务拒绝节点接入：{}", ack.message);
                    }
                    if !*accepted {
                        *accepted = true;
                        node.set_link("connected", "");
                        node.log("log", "已连接总服务");
                    }
                    send_progress_now = true;
                }
                Some(master_frame::Payload::Task(task)) => {
                    if !*accepted {
                        bail!("总服务在确认节点注册之前下发了任务");
                    }
                    node.submit(task);
                    send_progress_now = true;
                }
                None => {}
            }
        }
        _ = heartbeat.tick() => {
            send_frame(&sender, shutdown, NodeFrame {
                payload: Some(node_frame::Payload::Register(node.register(false))),
            }).await?;
            send_progress_now = *accepted;
        }
        _ = logs.tick(), if *accepted => {
            if pending_logs.is_empty() {
                *pending_logs = node.take_logs(200);
            }
            if !pending_logs.is_empty() {
                send_frame(&sender, shutdown, NodeFrame {
                    payload: Some(node_frame::Payload::Logs(NodeLogBatch {
                        node_id: node.config.node_id.clone(),
                        entries: pending_logs.clone(),
                    })),
                }).await?;
                pending_logs.clear();
            }
        }
        _ = node.changed.notified(), if *accepted => {
            if node.is_stopping() && !advertised_unavailable {
                send_frame(&sender, shutdown, NodeFrame {
                    payload: Some(node_frame::Payload::Register(node.register(false))),
                }).await?;
                advertised_unavailable = true;
            }
            send_progress_now = true;
        }
    }
    if send_progress_now {
      let snapshot = node.progress_snapshot();
      for progress in changed_progress(&snapshot, &last_sent) {
        send_frame(
          &sender,
          shutdown,
          NodeFrame {
            payload: Some(node_frame::Payload::Progress(progress.clone())),
          },
        )
        .await?;
        last_sent.insert(progress.task_id.clone(), progress);
      }
      // The node's terminal cache is bounded; retain only IDs still in it.
      let retained_ids: HashSet<_> = snapshot
        .iter()
        .map(|progress| progress.task_id.as_str())
        .collect();
      last_sent.retain(|id, _| retained_ids.contains(id.as_str()));
    }
  }
}

fn changed_progress(
  snapshot: &[ProgressUpdate],
  last_sent: &HashMap<String, ProgressUpdate>,
) -> Vec<ProgressUpdate> {
  snapshot
    .iter()
    .filter(|progress| last_sent.get(&progress.task_id) != Some(*progress))
    .cloned()
    .collect()
}

async fn send_frame(
  sender: &mpsc::Sender<NodeFrame>,
  shutdown: &mut watch::Receiver<bool>,
  frame: NodeFrame,
) -> Result<()> {
  tokio::select! {
      _ = cancelled(shutdown) => bail!("节点正在关闭"),
      result = time::timeout(SEND_TIMEOUT, sender.send(frame)) => {
          result.context("总服务上行流持续拥塞")?.context("总服务上行流已关闭")?;
          Ok(())
      }
  }
}

fn is_stopping(shutdown: &watch::Receiver<bool>) -> bool {
  *shutdown.borrow() || shutdown.has_changed().is_err()
}

async fn cancelled(shutdown: &mut watch::Receiver<bool>) {
  while !*shutdown.borrow() {
    if shutdown.changed().await.is_err() {
      return;
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn reports_only_changed_progress_and_replays_terminal_after_reconnect() {
    let mut active = ProgressUpdate {
      task_id: "task-1".into(),
      target: 100,
      progress: 20,
      ..Default::default()
    };
    let mut sent = HashMap::new();
    assert_eq!(changed_progress(&[active.clone()], &sent), [active.clone()]);
    sent.insert(active.task_id.clone(), active.clone());
    assert!(changed_progress(&[active.clone()], &sent).is_empty());
    active.progress = 100;
    active.completed = true;
    assert_eq!(changed_progress(&[active.clone()], &sent), [active.clone()]);
    assert_eq!(
      changed_progress(&[active.clone()], &HashMap::new()),
      [active]
    );
  }

  #[tokio::test]
  async fn shutdown_cancels_a_blocked_bounded_send() {
    let (sender, _receiver) = mpsc::channel(1);
    sender.send(NodeFrame::default()).await.unwrap();
    let (stop, mut shutdown) = watch::channel(false);
    stop.send(true).unwrap();
    assert!(time::timeout(
      Duration::from_millis(100),
      send_frame(&sender, &mut shutdown, NodeFrame::default())
    )
    .await
    .unwrap()
    .is_err());
  }
}
