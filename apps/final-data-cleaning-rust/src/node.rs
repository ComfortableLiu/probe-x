use crate::{
  attribution::{visit_attributions, Attribution, Event},
  config::{Config, NodeEndpoint},
  metrics::Metrics,
  proto::{ComputeTask, NodeInfo, NodeLogEntry, NodeRegister, ProgressUpdate},
  resources::ResourceMonitor,
  state_store::{slice_lease_key, StateStore},
  storage::ClickHouse,
};
use anyhow::{anyhow, bail, Result};
use std::{
  collections::{HashMap, VecDeque},
  sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
  },
  time::{Duration, Instant},
};
use tokio::sync::{mpsc, oneshot, Notify, Semaphore};

const TERMINAL_LIMIT: usize = 1000;
const LOG_LIMIT: usize = 2000;

// Cancelling a task must also cancel its prefetched HTTP response immediately.
struct ReaderTask(tokio::task::JoinHandle<()>);
impl Drop for ReaderTask {
  fn drop(&mut self) {
    self.0.abort();
  }
}

struct Snapshot {
  active: HashMap<String, ProgressUpdate>,
  terminal: VecDeque<ProgressUpdate>,
  logs: VecDeque<NodeLogEntry>,
  link: String,
  error: String,
  connected_at: Option<i64>,
  endpoint: NodeEndpoint,
}

pub struct Node {
  pub config: Arc<Config>,
  pub changed: Notify,
  store: StateStore,
  clickhouse: ClickHouse,
  cpu: rayon::ThreadPool,
  slots: Arc<Semaphore>,
  state: Mutex<Snapshot>,
  resources: Mutex<ResourceMonitor>,
  stopping: AtomicBool,
  abort_tasks: AtomicBool,
  idle: Notify,
  max_attributions: usize,
  metrics: Metrics,
}

impl Node {
  pub fn new(config: Arc<Config>, store: StateStore, clickhouse: ClickHouse) -> Result<Arc<Self>> {
    let cpu = rayon::ThreadPoolBuilder::new()
      .num_threads(config.concurrency)
      .thread_name(|i| format!("cleaning-cpu-{i}"))
      .build()?;
    let max_attributions = crate::config::integer(
      &config.values,
      "RUST_MAX_ATTRIBUTIONS_PER_BATCH",
      100000,
      1,
      1000000,
    )?;
    let endpoint = NodeEndpoint {
      node_address: config.advertise_address.trim().to_owned(),
      node_port: config.advertise_port.unwrap_or(0),
      ..Default::default()
    };
    Ok(Arc::new(Self {
      slots: Arc::new(Semaphore::new(config.task_concurrency)),
      config,
      changed: Notify::new(),
      metrics: Metrics::new(store.clone()),
      store,
      clickhouse,
      cpu,
      state: Mutex::new(Snapshot {
        active: HashMap::new(),
        terminal: VecDeque::new(),
        logs: VecDeque::new(),
        link: "connecting".into(),
        error: String::new(),
        connected_at: None,
        endpoint,
      }),
      resources: Mutex::new(ResourceMonitor::new()),
      stopping: AtomicBool::new(false),
      abort_tasks: AtomicBool::new(false),
      idle: Notify::new(),
      max_attributions,
    }))
  }

  pub fn register(&self, include_terminals: bool) -> NodeRegister {
    let (mut task_ids, endpoint): (Vec<String>, _) = {
      let state = self.state.lock().unwrap();
      let mut ids: Vec<String> = state.active.keys().cloned().collect();
      if include_terminals {
        ids.extend(state.terminal.iter().map(|p| p.task_id.clone()));
      }
      (ids, state.endpoint.clone())
    };
    task_ids.sort();
    task_ids.dedup();
    let mut info: NodeInfo = self
      .resources
      .lock()
      .unwrap()
      .sample(task_ids, self.config.task_concurrency);
    info.available = !self.stopping.load(Ordering::Acquire);
    NodeRegister {
      node_id: self.config.node_id.clone(),
      node_name: self.config.node_name.clone(),
      node_address: endpoint.node_address,
      node_port: i32::from(endpoint.node_port),
      health_host: endpoint.health_host,
      health_port: i32::from(endpoint.health_port),
      version: format!("rust-{}", env!("CARGO_PKG_VERSION")),
      info: Some(info),
    }
  }

  pub fn health(&self) -> serde_json::Value {
    let state = self.state.lock().unwrap();
    let ids: Vec<_> = state.active.keys().cloned().collect();
    serde_json::json!({
      "status": if state.link == "connected" && !self.stopping.load(Ordering::Acquire) { "ok" } else { "degraded" },
      "implementation": "rust", "nodeId": self.config.node_id, "nodeName": self.config.node_name,
      "link": state.link, "lastError": state.error, "connectedAt": state.connected_at,
      "cpuThreads": self.config.concurrency, "taskCapacity": self.config.task_concurrency,
      "activeTaskCount": ids.len(), "currentTaskIds": ids,
      "stopping": self.stopping.load(Ordering::Acquire),
      "nodeAddress": state.endpoint.node_address, "nodePort": state.endpoint.node_port,
      "healthHost": state.endpoint.health_host, "healthPort": state.endpoint.health_port,
    })
  }
  pub fn set_health_endpoint(&self, host: String, port: u16) -> Result<()> {
    let endpoint = self.config.endpoint_for_listener(host, port)?;
    self.state.lock().unwrap().endpoint = endpoint;
    self.changed.notify_one();
    Ok(())
  }
  pub fn set_link(&self, status: &str, error: &str) {
    let mut state = self.state.lock().unwrap();
    if status == "connected" && state.link != "connected" {
      state.connected_at = Some(chrono::Utc::now().timestamp_millis());
    }
    if status != "connected" {
      state.connected_at = None;
    }
    state.link = status.into();
    state.error = error.into();
  }
  pub fn log(&self, level: &str, message: &str) {
    eprintln!("[{}] [{}] {}", self.config.node_id, level, message);
    let mut state = self.state.lock().unwrap();
    if state.logs.len() >= LOG_LIMIT {
      state.logs.pop_front();
    }
    state.logs.push_back(NodeLogEntry {
      ts: chrono::Utc::now().timestamp_millis() as f64,
      level: level.into(),
      message: message.chars().take(16384).collect(),
    });
  }
  pub fn take_logs(&self, max: usize) -> Vec<NodeLogEntry> {
    let mut state = self.state.lock().unwrap();
    let count = max.min(state.logs.len());
    state.logs.drain(..count).collect()
  }
  pub fn progress_snapshot(&self) -> Vec<ProgressUpdate> {
    let state = self.state.lock().unwrap();
    state
      .active
      .values()
      .chain(state.terminal.iter())
      .cloned()
      .collect()
  }
  fn progress(&self, value: ProgressUpdate) {
    if let Some(current) = self.state.lock().unwrap().active.get_mut(&value.task_id) {
      *current = value;
    }
    self.changed.notify_one();
  }
  fn terminal(&self, value: ProgressUpdate) {
    let mut state = self.state.lock().unwrap();
    state.active.remove(&value.task_id);
    state.terminal.retain(|p| p.task_id != value.task_id);
    state.terminal.push_back(value);
    if state.terminal.len() > TERMINAL_LIMIT {
      state.terminal.pop_front();
    }
    drop(state);
    self.changed.notify_one();
    // notify_one retains a permit if completion races with drain() polling.
    self.idle.notify_one();
  }

  pub fn submit(self: &Arc<Self>, task: ComputeTask) {
    let mut state = self.state.lock().unwrap();
    if state.active.contains_key(&task.task_id)
      || state.terminal.iter().any(|p| p.task_id == task.task_id)
    {
      drop(state);
      self.changed.notify_one();
      return;
    }
    let permit = self.slots.clone().try_acquire_owned();
    if self.stopping.load(Ordering::Acquire)
      || permit.is_err()
      || state.active.len() >= self.config.task_concurrency
    {
      drop(state);
      self.terminal(self.update(&task, 0, 0, false, Some("节点正在关闭或任务容量已满")));
      return;
    }
    state
      .active
      .insert(task.task_id.clone(), self.update(&task, 0, 0, false, None));
    drop(state);
    self.changed.notify_one();
    let node = Arc::clone(self);
    tokio::spawn(async move {
      let permit = permit.unwrap();
      let result = node.execute(&task).await;
      let terminal = match result {
        Ok((target, replay)) => {
          node
            .update(&task, target, target, true, None)
            .with_message(if replay {
              "任务已完成，跳过重复执行"
            } else {
              "任务完成"
            })
        }
        Err(error) => {
          let error = error.to_string();
          node.log("error", &format!("清洗任务失败：{error}"));
          node.update(&task, 0, 0, false, Some(&error))
        }
      };
      // Release capacity before the master observes terminal progress and refills it.
      drop(permit);
      node.terminal(terminal);
    });
  }

  fn update(
    &self,
    task: &ComputeTask,
    total: u64,
    processed: u64,
    completed: bool,
    error: Option<&str>,
  ) -> ProgressUpdate {
    ProgressUpdate {
      task_id: task.task_id.clone(),
      node_id: self.config.node_id.clone(),
      target: total.min(i32::MAX as u64) as i32,
      progress: processed.min(i32::MAX as u64) as i32,
      completed,
      failed: error.is_some(),
      error: error.unwrap_or("").into(),
      message: if completed {
        "任务完成"
      } else {
        "正在清洗"
      }
      .into(),
    }
  }

  async fn execute(&self, task: &ComputeTask) -> Result<(u64, bool)> {
    let date = chrono::NaiveDate::parse_from_str(&task.date, "%Y-%m-%d")
      .map_err(|_| anyhow!("任务日期格式无效"))?;
    let today = chrono::Utc::now()
      .with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap())
      .date_naive();
    if date.format("%Y-%m-%d").to_string() != task.date || date >= today {
      bail!("任务必须是今天以前的有效日期");
    }
    if task.task_id.is_empty() || task.task_id.len() > 16384 || task.session_id.len() > 4096 {
      bail!("任务标识无效或超长");
    }
    let lease = slice_lease_key(&task.date, &task.session_id);
    let owner = uuid::Uuid::new_v4().to_string();
    let deadline = Instant::now() + Duration::from_secs(self.config.lease_seconds as u64 * 2);
    let completed = loop {
      let started = self
        .store
        .begin_attempt(
          &lease,
          &owner,
          self.config.lease_seconds,
          &task.task_id,
          &task.date,
          &task.session_id,
        )
        .await?;
      if started.acquired {
        break started.completed;
      }
      if self.abort_tasks.load(Ordering::Acquire) || Instant::now() >= deadline {
        bail!("等待会话清洗租约超时");
      }
      tokio::time::sleep(Duration::from_millis(200)).await;
    };
    let result = async {
      if completed {
        self.store.clear_incomplete(&task.date, &task.session_id).await?;
        return Ok((0, true));
      }
      let work = self.clean(task);
      tokio::pin!(work);
      let mut renew = tokio::time::interval(Duration::from_secs((self.config.lease_seconds / 3) as u64));
      renew.tick().await;
      loop {
        tokio::select! {
          result = &mut work => break result.map(|count| (count, false)),
          _ = renew.tick() => {
            if self.abort_tasks.load(Ordering::Acquire) { bail!("节点关闭，保留未完成切片供重试"); }
            if !self.store.renew(&lease, &owner, self.config.lease_seconds).await? { bail!("会话清洗租约已失效"); }
          }
        }
      }
    }.await;
    let result = match result {
      Ok((count, false)) => self
        .store
        .complete_attempt(&task.task_id, &task.date, &task.session_id, &lease, &owner)
        .await
        .map(|()| (count, false)),
      other => {
        if self.store.fail_attempt(&lease, &owner).await.is_err() {
          self.log("warn", "释放会话租约失败，将在到期后自动释放");
        }
        other
      }
    };
    if !matches!(result, Ok((_, true))) {
      self.metrics.record_outcome(result.is_ok());
    }
    result
  }

  async fn clean(&self, task: &ComputeTask) -> Result<u64> {
    // Retain the count/EOF consistency check, but overlap these independent
    // requests instead of paying an extra serial HTTP round trip per session.
    let (total, mut stream) = tokio::try_join!(
      self.clickhouse.count_slice(&task.date, &task.session_id),
      self.clickhouse.read_slice(&task.date, &task.session_id),
    )?;
    if total > i32::MAX as u64 {
      bail!("单个会话事件数超过当前 gRPC 进度协议的 Int32 上限");
    }
    self.progress(self.update(task, total, 0, false, None));
    let (sender, mut batches) = mpsc::channel(1);
    let _reader = ReaderTask(tokio::spawn(async move {
      // Reserve before reading: at most one prefetched batch can coexist with
      // the batch being computed/written, including a pending send.
      while let Ok(permit) = sender.reserve().await {
        let next = stream.next_batch().await;
        let finished = !matches!(&next, Ok(Some(_)));
        permit.send(next);
        if finished {
          break;
        }
      }
    }));
    let mut processed = 0u64;
    let mut last_progress = Instant::now();
    loop {
      // An explicit EOF distinguishes a complete response from a crashed reader.
      let Some(events) = batches
        .recv()
        .await
        .ok_or_else(|| anyhow!("事件读取流提前终止"))??
      else {
        break;
      };
      if self.abort_tasks.load(Ordering::Acquire) {
        bail!("节点关闭，保留未完成切片供重试");
      }
      let (events, attributions) = self.compute(events).await?;
      let batch_count = events.len() as u64;
      // Each table repairs already-written rows independently. Retrying a partially
      // written batch must not skip attribution rows merely because final rows exist.
      let writes = tokio::join!(
        self
          .clickhouse
          .write_events(&task.date, &task.session_id, &events),
        self
          .clickhouse
          .write_attributions(&task.date, &task.session_id, &attributions),
      );
      if let Ok(inserted) = writes.0.as_ref() {
        self.metrics.record_processed(*inserted);
      }
      writes.0?;
      writes.1?;
      processed += batch_count;
      if last_progress.elapsed() >= Duration::from_millis(100) {
        self.progress(self.update(task, total, processed.min(total), false, None));
        last_progress = Instant::now();
      }
    }
    if processed != total {
      bail!("读取期间会话事件数量变化，保留切片等待重新清洗");
    }
    if self.config.detail_logs {
      self.log("log", &format!("清洗任务完成，处理 {processed} 条事件"));
    }
    Ok(total)
  }

  async fn compute(&self, events: Vec<Event>) -> Result<(Vec<Event>, Vec<Attribution>)> {
    let (send, receive) = oneshot::channel();
    let limit = self.max_attributions;
    self.cpu.spawn(move || {
      let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let mut rows = Vec::new();
        let mut overflow = false;
        for event in &events {
          visit_attributions(event, |row| {
            if rows.len() >= limit {
              overflow = true;
            } else {
              rows.push(row);
            }
          });
        }
        if overflow {
          Err(anyhow!(
            "当前批次归因记录过多，请降低 RUST_BATCH_SIZE 或提高归因批次上限"
          ))
        } else {
          Ok((events, rows))
        }
      }))
      .unwrap_or_else(|_| Err(anyhow!("归因计算线程异常")));
      let _ = send.send(result);
    });
    receive.await.map_err(|_| anyhow!("归因计算线程已退出"))?
  }
  pub async fn flush_metrics(&self, timeout: Duration) -> bool {
    self.metrics.shutdown(timeout).await
  }
  pub fn begin_shutdown(&self) {
    self.stopping.store(true, Ordering::Release);
    self.changed.notify_one();
  }
  pub fn is_stopping(&self) -> bool {
    self.stopping.load(Ordering::Acquire)
  }
  pub async fn drain(&self, timeout: Duration) -> bool {
    let wait = async {
      loop {
        let notified = self.idle.notified();
        if self.state.lock().unwrap().active.is_empty() {
          return;
        }
        notified.await;
      }
    };
    if tokio::time::timeout(timeout, wait).await.is_ok() {
      true
    } else {
      self.abort_tasks.store(true, Ordering::Release);
      false
    }
  }
}

trait ProgressMessage {
  fn with_message(self, message: &str) -> Self;
}
impl ProgressMessage for ProgressUpdate {
  fn with_message(mut self, message: &str) -> Self {
    self.message = message.into();
    self
  }
}
