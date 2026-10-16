//! Exercise the real Rust node over local RESP, HTTP and protobuf transports.
//! All listeners and data are owned by these tests; no configured service is used.

use std::{
  collections::{HashMap, HashSet},
  io::Read,
  sync::{
    atomic::{AtomicBool, AtomicUsize, Ordering},
    Arc, Mutex,
  },
  time::Duration,
};

use axum::{
  body::Bytes,
  extract::State,
  http::{HeaderMap, StatusCode},
  routing::{get, post},
  Json, Router,
};
use probe_x_final_cleaning_rust::{
  attribution::{compute_attribution, Event},
  config::Config,
  connection,
  node::Node,
  proto::{
    master_frame,
    node_control_service_server::{NodeControlService, NodeControlServiceServer},
    node_frame, ComputeTask, MasterAck, MasterFrame, NodeFrame,
  },
  state_store::{incomplete_key, StateStore},
  storage::{ClickHouse, StorageConfig},
};
use serde_json::{json, Value};
use tokio::{
  io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader},
  net::{tcp::OwnedReadHalf, TcpListener},
  sync::{mpsc, watch, Notify},
  task::JoinHandle,
};
use tokio_stream::wrappers::{ReceiverStream, TcpListenerStream};
use tonic::{Request, Response, Status};

const DATE: &str = "2020-01-01";

async fn wait_for(mut condition: impl FnMut() -> bool, message: &str) {
  let deadline = tokio::time::Instant::now() + Duration::from_secs(8);
  while !condition() {
    assert!(tokio::time::Instant::now() < deadline, "{message}");
    tokio::time::sleep(Duration::from_millis(5)).await;
  }
}

fn task(id: &str, session: &str) -> ComputeTask {
  ComputeTask {
    task_id: id.into(),
    session_id: session.into(),
    date: DATE.into(),
  }
}

fn source(session: &str) -> Vec<Event> {
  (0..3)
    .map(|index| {
      serde_json::from_value(json!({
          "$event_id": format!("{session}-event-{index}"),
          "$session_id": session,
          "$service_time": format!("{DATE} 01:00:00.{index:03}"),
          "$is_attribution_event": true,
          "$target_page_id": "landing",
          "$ex_attribution_params": {
              "$campaign_id": "same-campaign", "$campaignId": "same-campaign", "event_index": index,
          },
          "$uid": u64::MAX,
          "future_wide_column": {"array": [true, null, "中文"]},
      }))
      .unwrap()
    })
    .collect()
}

#[derive(Default)]
struct RedisMemory {
  values: HashMap<String, String>,
  sets: HashMap<String, HashSet<String>>,
  processed: u64,
}

async fn resp_command(reader: &mut BufReader<OwnedReadHalf>) -> Option<Vec<String>> {
  let mut line = String::new();
  if reader.read_line(&mut line).await.ok()? == 0 {
    return None;
  }
  let count = line.strip_prefix('*')?.trim().parse::<usize>().ok()?;
  let mut args = Vec::with_capacity(count);
  for _ in 0..count {
    line.clear();
    reader.read_line(&mut line).await.ok()?;
    let length = line.strip_prefix('$')?.trim().parse::<usize>().ok()?;
    let mut value = vec![0; length + 2];
    reader.read_exact(&mut value).await.ok()?;
    args.push(String::from_utf8(value[..length].to_vec()).ok()?);
  }
  Some(args)
}

fn redis_reply(args: &[String], memory: &mut RedisMemory) -> String {
  match args[0].to_ascii_uppercase().as_str() {
    "PING" => "+PONG\r\n".into(),
    "AUTH" | "SELECT" | "CLIENT" => "+OK\r\n".into(),
    "ECHO" => format!("${}\r\n{}\r\n", args[1].len(), args[1]),
    "SET" => {
      if args.iter().any(|arg| arg.eq_ignore_ascii_case("NX"))
        && memory.values.contains_key(&args[1])
      {
        "$-1\r\n".into()
      } else {
        memory.values.insert(args[1].clone(), args[2].clone());
        "+OK\r\n".into()
      }
    }
    "EXISTS" => format!(":{}\r\n", i32::from(memory.values.contains_key(&args[1]))),
    "GET" => memory.values.get(&args[1]).map_or_else(
      || "$-1\r\n".into(),
      |value| format!("${}\r\n{value}\r\n", value.len()),
    ),
    "SADD" => {
      let inserted = memory
        .sets
        .entry(args[1].clone())
        .or_default()
        .insert(args[2].clone());
      format!(":{}\r\n", i32::from(inserted))
    }
    "SREM" => {
      let removed = memory
        .sets
        .entry(args[1].clone())
        .or_default()
        .remove(&args[2]);
      format!(":{}\r\n", i32::from(removed))
    }
    "EVAL" => {
      if args[1].contains("'GET'") {
        let owns = memory.values.get(&args[3]) == Some(&args[4]);
        if owns && args[1].contains("'DEL'") {
          memory.values.remove(&args[3]);
        }
        format!(":{}\r\n", i32::from(owns))
      } else {
        if args[1].contains("'HSETNX'") {
          memory.processed += args[5].parse::<u64>().unwrap();
        }
        ":1\r\n".into()
      }
    }
    _ => "-ERR unsupported local test command\r\n".into(),
  }
}

async fn redis_server(memory: Arc<Mutex<RedisMemory>>) -> (u16, JoinHandle<()>) {
  let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
  let port = listener.local_addr().unwrap().port();
  let handle = tokio::spawn(async move {
    loop {
      let Ok((socket, _)) = listener.accept().await else {
        return;
      };
      let memory = memory.clone();
      tokio::spawn(async move {
        let (read, mut write) = socket.into_split();
        let mut read = BufReader::new(read);
        while let Some(args) = resp_command(&mut read).await {
          let reply = redis_reply(&args, &mut memory.lock().unwrap());
          if write.write_all(reply.as_bytes()).await.is_err() {
            break;
          }
        }
      });
    }
  });
  (port, handle)
}

struct Data {
  source: HashMap<String, Vec<Event>>,
  final_events: Mutex<Vec<Event>>,
  attributions: Mutex<Vec<Value>>,
  block_counts: AtomicBool,
  count_started: AtomicUsize,
  read_started: AtomicUsize,
  release: Notify,
  fail_attribution_once: AtomicBool,
  requests: AtomicUsize,
  final_inserts: AtomicUsize,
  attribution_inserts: AtomicUsize,
}

impl Data {
  fn new(sessions: &[&str]) -> Arc<Self> {
    Arc::new(Self {
      source: sessions
        .iter()
        .map(|session| ((*session).into(), source(session)))
        .collect(),
      final_events: Mutex::new(Vec::new()),
      attributions: Mutex::new(Vec::new()),
      block_counts: AtomicBool::new(false),
      count_started: AtomicUsize::new(0),
      read_started: AtomicUsize::new(0),
      release: Notify::new(),
      fail_attribution_once: AtomicBool::new(false),
      requests: AtomicUsize::new(0),
      final_inserts: AtomicUsize::new(0),
      attribution_inserts: AtomicUsize::new(0),
    })
  }
  fn unblock(&self) {
    self.block_counts.store(false, Ordering::SeqCst);
    self.release.notify_waiters();
  }
  fn assert_complete(&self, sessions: &[&str]) {
    let expected = compute_attribution(
      sessions
        .iter()
        .flat_map(|session| self.source[*session].clone())
        .collect(),
    );
    let mut actual_events = self.final_events.lock().unwrap().clone();
    let mut expected_events = expected.final_events;
    actual_events.sort_by_key(|row| row["$event_id"].as_str().unwrap().to_owned());
    expected_events.sort_by_key(|row| row["$event_id"].as_str().unwrap().to_owned());
    assert_eq!(actual_events, expected_events);
    assert!(actual_events
      .iter()
      .all(|event| event["$uid"].as_u64() == Some(u64::MAX)));
    let mut actual_attrs = self
      .attributions
      .lock()
      .unwrap()
      .iter()
      .map(|row| serde_json::to_string(row).unwrap())
      .collect::<Vec<_>>();
    let mut expected_attrs = expected
      .attributions
      .iter()
      .map(|row| serde_json::to_string(row).unwrap())
      .collect::<Vec<_>>();
    actual_attrs.sort();
    expected_attrs.sort();
    assert_eq!(actual_attrs, expected_attrs);
  }
}

fn multipart(headers: &HeaderMap, body: &str) -> HashMap<String, String> {
  let Some(boundary) = headers
    .get("content-type")
    .and_then(|value| value.to_str().ok())
    .and_then(|value| value.split("boundary=").nth(1))
  else {
    return HashMap::from([("query".into(), body.into())]);
  };
  let mut fields = HashMap::new();
  for part in body.split(&format!("--{}", boundary.trim_matches('"'))) {
    let Some((header, value)) = part.split_once("\r\n\r\n") else {
      continue;
    };
    let Some(name) = header
      .split("name=\"")
      .nth(1)
      .and_then(|value| value.split('"').next())
    else {
      continue;
    };
    fields.insert(
      name.into(),
      value.strip_suffix("\r\n").unwrap_or(value).into(),
    );
  }
  fields
}

fn json_lines(rows: impl IntoIterator<Item = Value>) -> String {
  rows
    .into_iter()
    .map(|row| format!("{}\n", serde_json::to_string(&row).unwrap()))
    .collect()
}

async fn clickhouse_handler(
  State(data): State<Arc<Data>>,
  headers: HeaderMap,
  body: Bytes,
) -> (StatusCode, String) {
  data.requests.fetch_add(1, Ordering::SeqCst);
  let decoded = if headers
    .get("content-encoding")
    .is_some_and(|encoding| encoding == "gzip")
  {
    let mut decoded = String::new();
    flate2::read::GzDecoder::new(body.as_ref())
      .read_to_string(&mut decoded)
      .unwrap();
    decoded
  } else {
    std::str::from_utf8(&body).unwrap().to_owned()
  };
  let fields = multipart(&headers, &decoded);
  let sql = &fields["query"];
  let session = fields
    .get("param_sessionId")
    .map(String::as_str)
    .unwrap_or("");
  let response = if sql.starts_with("SELECT 1") {
    "{\"ok\":1}\n".into()
  } else if sql.contains("count() AS count FROM event_log") {
    data.count_started.fetch_add(1, Ordering::SeqCst);
    loop {
      let notified = data.release.notified();
      if !data.block_counts.load(Ordering::SeqCst) {
        break;
      }
      notified.await;
    }
    format!("{{\"count\":{}}}\n", data.source[session].len())
  } else if sql.starts_with("SELECT * FROM event_log") {
    data.read_started.fetch_add(1, Ordering::SeqCst);
    json_lines(data.source[session].iter().cloned().map(Value::Object))
  } else if sql.contains("FROM final_event_log") {
    let ids: HashSet<String> = serde_json::from_str(&fields["param_eventIds"]).unwrap();
    json_lines(
      data
        .final_events
        .lock()
        .unwrap()
        .iter()
        .filter(|row| {
          row["$session_id"] == session && ids.contains(row["$event_id"].as_str().unwrap())
        })
        .map(|row| json!({"$event_id": row["$event_id"]})),
    )
  } else if sql.contains("FROM event_attribution") {
    let keys: HashSet<(String, String, String)> =
      serde_json::from_str(&fields["param_attributionKeys"]).unwrap();
    let mut counts = HashMap::new();
    for row in data
      .attributions
      .lock()
      .unwrap()
      .iter()
      .filter(|row| row["session_id"] == session)
    {
      let key = (
        row["event_id"].as_str().unwrap().to_owned(),
        row["attr_key"].as_str().unwrap().to_owned(),
        row["attr_value"].as_str().unwrap().to_owned(),
      );
      if keys.contains(&key) {
        *counts.entry(key).or_insert(0_u64) += 1;
      }
    }
    json_lines(counts.into_iter().map(|((id, key, value), count)| json!({"event_id": id, "attr_key": key, "attr_value": value, "rows": count})))
  } else if sql.starts_with("INSERT INTO final_event_log") {
    data.final_inserts.fetch_add(1, Ordering::SeqCst);
    data.final_events.lock().unwrap().extend(
      sql
        .lines()
        .skip(1)
        .filter(|line| !line.is_empty())
        .map(|line| serde_json::from_str::<Event>(line).unwrap()),
    );
    String::new()
  } else if sql.starts_with("INSERT INTO event_attribution") {
    data.attribution_inserts.fetch_add(1, Ordering::SeqCst);
    let rows: Vec<Value> = sql
      .lines()
      .skip(1)
      .filter(|line| !line.is_empty())
      .map(|line| serde_json::from_str(line).unwrap())
      .collect();
    if data.fail_attribution_once.swap(false, Ordering::SeqCst) {
      // Model a late ClickHouse error after one row was actually committed.
      data.attributions.lock().unwrap().push(rows[0].clone());
      return (
        StatusCode::SERVICE_UNAVAILABLE,
        "simulated partial insert".into(),
      );
    }
    data.attributions.lock().unwrap().extend(rows);
    String::new()
  } else {
    panic!("unexpected local ClickHouse query");
  };
  (StatusCode::OK, response)
}

#[derive(Default)]
struct MasterState {
  connections: AtomicUsize,
  frames: Mutex<Vec<(usize, NodeFrame)>>,
  senders: Mutex<HashMap<usize, mpsc::Sender<Result<MasterFrame, Status>>>>,
}

#[derive(Clone, Default)]
struct Master(Arc<MasterState>);

#[tonic::async_trait]
impl NodeControlService for Master {
  type ConnectStream = ReceiverStream<Result<MasterFrame, Status>>;

  async fn connect(
    &self,
    request: Request<tonic::Streaming<NodeFrame>>,
  ) -> Result<Response<Self::ConnectStream>, Status> {
    let id = self.0.connections.fetch_add(1, Ordering::SeqCst) + 1;
    let (sender, receiver) = mpsc::channel(64);
    self.0.senders.lock().unwrap().insert(id, sender.clone());
    let state = self.0.clone();
    let mut input = request.into_inner();
    tokio::spawn(async move {
      let mut registered = false;
      while let Ok(Some(frame)) = input.message().await {
        let is_register = matches!(&frame.payload, Some(node_frame::Payload::Register(_)));
        state.frames.lock().unwrap().push((id, frame));
        if is_register && !registered {
          registered = true;
          let ack = MasterFrame {
            payload: Some(master_frame::Payload::Ack(MasterAck {
              accepted: true,
              message: String::new(),
            })),
          };
          if sender.send(Ok(ack)).await.is_err() {
            break;
          }
        }
      }
      state.senders.lock().unwrap().remove(&id);
    });
    Ok(Response::new(ReceiverStream::new(receiver)))
  }
}

impl Master {
  async fn send(&self, task: ComputeTask) {
    let sender = self
      .0
      .senders
      .lock()
      .unwrap()
      .iter()
      .max_by_key(|(id, _)| *id)
      .unwrap()
      .1
      .clone();
    sender
      .send(Ok(MasterFrame {
        payload: Some(master_frame::Payload::Task(task)),
      }))
      .await
      .unwrap();
  }
  fn terminal(&self, task: &str, completed: bool) -> bool {
    self
      .0
      .frames
      .lock()
      .unwrap()
      .iter()
      .any(|(_, frame)| match &frame.payload {
        Some(node_frame::Payload::Progress(progress)) => {
          progress.task_id == task
            && if completed {
              progress.completed && !progress.failed
            } else {
              progress.failed
            }
        }
        _ => false,
      })
  }
  async fn disconnect(&self) {
    let id = *self.0.senders.lock().unwrap().keys().max().unwrap();
    let sender = self.0.senders.lock().unwrap().remove(&id).unwrap();
    sender
      .send(Err(Status::unavailable("simulated disconnect")))
      .await
      .unwrap();
  }
}

struct Fixture {
  node: Arc<Node>,
  store: StateStore,
  storage: ClickHouse,
  data: Arc<Data>,
  redis: Arc<Mutex<RedisMemory>>,
  master: Master,
  shutdown: watch::Sender<bool>,
  connection: Option<JoinHandle<()>>,
  servers: Vec<JoinHandle<()>>,
  health_port: u16,
}

impl Fixture {
  async fn new(sessions: &[&str], block_counts: bool, fail_partial: bool) -> Self {
    Self::with_storage(sessions, block_counts, fail_partial, false, 0, 2).await
  }

  async fn with_storage(
    sessions: &[&str],
    block_counts: bool,
    fail_partial: bool,
    compression: bool,
    write_batch_wait_ms: u64,
    batch_size: usize,
  ) -> Self {
    let redis = Arc::new(Mutex::new(RedisMemory::default()));
    let (redis_port, redis_handle) = redis_server(redis.clone()).await;
    let data = Data::new(sessions);
    data.block_counts.store(block_counts, Ordering::SeqCst);
    data
      .fail_attribution_once
      .store(fail_partial, Ordering::SeqCst);
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let clickhouse_url = format!("http://{}", listener.local_addr().unwrap());
    let router = Router::new()
      .route("/", post(clickhouse_handler))
      .with_state(data.clone());
    let http_handle = tokio::spawn(async move {
      axum::serve(listener, router).await.unwrap();
    });
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let master_port = listener.local_addr().unwrap().port();
    let master = Master::default();
    let service = NodeControlServiceServer::new(master.clone());
    let master_handle = tokio::spawn(async move {
      tonic::transport::Server::builder()
        .add_service(service)
        .serve_with_incoming(TcpListenerStream::new(listener))
        .await
        .unwrap();
    });
    let config = Arc::new(
      Config::from_values(HashMap::from([
        ("RUST_NODE_ID".into(), "rust-integration-node".into()),
        ("RUST_CLEANING_THREADS".into(), "2".into()),
        ("RUST_TASK_CONCURRENCY".into(), "2".into()),
        ("MASTER_HOST".into(), "127.0.0.1".into()),
        ("MASTER_PORT".into(), master_port.to_string()),
        ("REDIS_HOST".into(), "127.0.0.1".into()),
        ("REDIS_PORT".into(), redis_port.to_string()),
        ("HEARTBEAT_INTERVAL_MS".into(), "100".into()),
        ("NODE_LOG_FLUSH_INTERVAL_MS".into(), "100".into()),
      ]))
      .unwrap(),
    );
    let store = StateStore::connect(&config).await.unwrap();
    let storage = ClickHouse::new(StorageConfig {
      url: clickhouse_url,
      user: "test".into(),
      password: String::new(),
      database: "test".into(),
      timeout_ms: 5000,
      connection_timeout_ms: 1000,
      batch_size,
      max_batch_bytes: 1024 * 1024,
      max_event_bytes: 512 * 1024,
      reject_unauthorized: true,
      compression,
      write_batch_wait_ms,
    })
    .unwrap();
    let node = Node::new(config, store.clone(), storage.clone()).unwrap();
    let health_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let health_port = health_listener.local_addr().unwrap().port();
    node
      .set_health_endpoint("127.0.0.1".into(), health_port)
      .unwrap();
    let health_node = node.clone();
    let health_handle = tokio::spawn(async move {
      axum::serve(
        health_listener,
        Router::new().route(
          "/health",
          get(move || {
            let node = health_node.clone();
            async move { Json(node.health()) }
          }),
        ),
      )
      .await
      .unwrap();
    });
    let (shutdown, receiver) = watch::channel(false);
    let connection = tokio::spawn(connection::run(node.clone(), receiver));
    let fixture = Self {
      node,
      store,
      storage,
      data,
      redis,
      master,
      shutdown,
      connection: Some(connection),
      servers: vec![redis_handle, http_handle, master_handle, health_handle],
      health_port,
    };
    wait_for(
      || fixture.node.health()["link"] == "connected",
      "node must receive registration ACK",
    )
    .await;
    fixture
  }
  async fn stop(&mut self) {
    self.node.begin_shutdown();
    assert!(self.node.drain(Duration::from_secs(2)).await);
    assert!(self.node.flush_metrics(Duration::from_secs(2)).await);
    self.shutdown.send(true).unwrap();
    tokio::time::timeout(Duration::from_secs(2), self.connection.take().unwrap())
      .await
      .unwrap()
      .unwrap();
    assert_eq!(self.node.health()["stopping"], true);
    assert_eq!(self.node.health()["status"], "degraded");
    assert!(!self.node.register(false).info.unwrap().available);
  }
}

impl Drop for Fixture {
  fn drop(&mut self) {
    if let Some(connection) = &self.connection {
      connection.abort();
    }
    for server in &self.servers {
      server.abort();
    }
  }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn optimized_node_coalesces_sessions_with_compression_and_commits_each_task() {
  let mut fixture =
    Fixture::with_storage(&["merged-a", "merged-b"], true, false, true, 100, 1000).await;
  fixture.master.send(task("merged-task-a", "merged-a")).await;
  fixture.master.send(task("merged-task-b", "merged-b")).await;
  wait_for(
    || fixture.data.count_started.load(Ordering::SeqCst) == 2,
    "both sessions must reach the count barrier",
  )
  .await;
  fixture.data.unblock();
  wait_for(
    || {
      fixture.master.terminal("merged-task-a", true)
        && fixture.master.terminal("merged-task-b", true)
    },
    "both contributors must finish after compressed writes",
  )
  .await;
  fixture.data.assert_complete(&["merged-a", "merged-b"]);
  assert_eq!(fixture.data.final_inserts.load(Ordering::SeqCst), 1);
  assert_eq!(fixture.data.attribution_inserts.load(Ordering::SeqCst), 1);
  {
    let redis = fixture.redis.lock().unwrap();
    for (id, session) in [("merged-task-a", "merged-a"), ("merged-task-b", "merged-b")] {
      assert!(redis
        .values
        .contains_key(&format!("probe-x:rust-clean:done:{id}")));
      assert!(!redis.sets[&incomplete_key(DATE)].contains(session));
    }
  }
  fixture.stop().await;
  assert_eq!(fixture.redis.lock().unwrap().processed, 6);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn grpc_node_uses_configured_capacity_writes_equivalent_rows_and_skips_duplicate_tasks() {
  let mut fixture = Fixture::new(&["session-a", "session-b", "session-c"], true, false).await;
  let first_register = fixture
    .master
    .0
    .frames
    .lock()
    .unwrap()
    .iter()
    .find_map(|(_, frame)| match &frame.payload {
      Some(node_frame::Payload::Register(register)) => Some(register.clone()),
      _ => None,
    })
    .unwrap();
  assert_eq!(first_register.node_address, "127.0.0.1");
  assert_eq!(first_register.node_port, i32::from(fixture.health_port));
  assert_eq!(first_register.health_host, "127.0.0.1");
  assert_eq!(first_register.health_port, i32::from(fixture.health_port));
  let health: Value = reqwest::get(format!("http://127.0.0.1:{}/health", fixture.health_port))
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
  assert_eq!(health["healthPort"], fixture.health_port);
  assert_eq!(first_register.info.unwrap().task_capacity, 2);
  fixture.master.send(task("task-a", "session-a")).await;
  fixture.master.send(task("task-b", "session-b")).await;
  wait_for(
    || fixture.data.count_started.load(Ordering::SeqCst) == 2,
    "two task slots must run concurrently",
  )
  .await;
  assert_eq!(fixture.node.health()["activeTaskCount"], 2);
  wait_for(
    || fixture.data.read_started.load(Ordering::SeqCst) == 2,
    "source reads must start while independent count queries are still blocked",
  )
  .await;
  fixture.master.send(task("task-c", "session-c")).await;
  wait_for(
    || fixture.master.terminal("task-c", false),
    "excess task must be rejected without growing the queue",
  )
  .await;
  assert_eq!(fixture.node.health()["activeTaskCount"], 2);
  assert_eq!(fixture.data.count_started.load(Ordering::SeqCst), 2);
  fixture.data.unblock();
  wait_for(
    || fixture.master.terminal("task-a", true) && fixture.master.terminal("task-b", true),
    "both accepted tasks must finish",
  )
  .await;
  fixture.data.assert_complete(&["session-a", "session-b"]);
  wait_for(
    || fixture.redis.lock().unwrap().processed == 6,
    "aggregated metrics must eventually include both completed tasks",
  )
  .await;
  let request_count = fixture.data.requests.load(Ordering::SeqCst);
  fixture.master.send(task("task-a", "session-a")).await;
  tokio::time::sleep(Duration::from_millis(200)).await;
  assert_eq!(fixture.data.requests.load(Ordering::SeqCst), request_count);
  assert_eq!(fixture.node.health()["activeTaskCount"], 0);
  // A fresh Node has no terminal cache and must honor the durable Redis marker.
  let restarted = Node::new(
    fixture.node.config.clone(),
    fixture.store.clone(),
    fixture.storage.clone(),
  )
  .unwrap();
  restarted.submit(task("task-a", "session-a"));
  wait_for(
    || {
      restarted
        .progress_snapshot()
        .iter()
        .any(|progress| progress.task_id == "task-a" && progress.completed)
    },
    "duplicate task after restart must use its durable completion marker",
  )
  .await;
  assert_eq!(fixture.data.requests.load(Ordering::SeqCst), request_count);
  restarted.begin_shutdown();
  assert!(restarted.drain(Duration::from_secs(1)).await);
  assert!(restarted.flush_metrics(Duration::from_secs(1)).await);
  assert!(
    fixture
      .master
      .0
      .frames
      .lock()
      .unwrap()
      .iter()
      .filter(|(_, frame)| matches!(&frame.payload, Some(node_frame::Payload::Register(_))))
      .count()
      >= 2
  );
  wait_for(|| fixture.master.0.frames.lock().unwrap().iter().any(|(_, frame)| matches!(&frame.payload, Some(node_frame::Payload::Logs(batch)) if !batch.entries.is_empty())), "node logs must use the protobuf stream").await;
  fixture.stop().await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn partial_two_table_failure_keeps_marker_then_retry_repairs_missing_rows_without_duplicates()
{
  let mut fixture = Fixture::new(&["session-retry"], false, true).await;
  fixture
    .master
    .send(task("task-retry", "session-retry"))
    .await;
  wait_for(
    || fixture.master.terminal("task-retry", false),
    "partial insert must fail the task",
  )
  .await;
  {
    let redis = fixture.redis.lock().unwrap();
    assert!(redis.sets[&incomplete_key(DATE)].contains("session-retry"));
    assert!(!redis
      .values
      .contains_key("probe-x:rust-clean:done:task-retry"));
  }
  assert_eq!(fixture.data.final_events.lock().unwrap().len(), 2);
  assert_eq!(fixture.data.attributions.lock().unwrap().len(), 1);
  fixture
    .master
    .send(task("task-retry:r1", "session-retry"))
    .await;
  wait_for(
    || fixture.master.terminal("task-retry:r1", true),
    "retry must complete both tables",
  )
  .await;
  fixture.data.assert_complete(&["session-retry"]);
  wait_for(
    || fixture.redis.lock().unwrap().processed == 3,
    "successful inserts must be counted once across partial failure and retry",
  )
  .await;
  {
    let redis = fixture.redis.lock().unwrap();
    assert!(!redis.sets[&incomplete_key(DATE)].contains("session-retry"));
    assert!(redis
      .values
      .contains_key("probe-x:rust-clean:done:task-retry:r1"));
    assert_eq!(redis.processed, 3);
  }
  fixture.stop().await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn reconnect_registers_and_replays_completion_that_happened_while_disconnected() {
  let mut fixture = Fixture::new(&["session-reconnect"], true, false).await;
  fixture
    .master
    .send(task("task-reconnect", "session-reconnect"))
    .await;
  wait_for(
    || fixture.data.count_started.load(Ordering::SeqCst) == 1,
    "task must start before disconnect",
  )
  .await;
  fixture.master.disconnect().await;
  wait_for(
    || fixture.node.health()["link"] == "disconnected",
    "node must observe the broken stream",
  )
  .await;
  fixture.data.unblock();
  wait_for(
    || {
      fixture
        .node
        .progress_snapshot()
        .iter()
        .any(|progress| progress.task_id == "task-reconnect" && progress.completed)
    },
    "disconnected task must continue and cache its terminal state",
  )
  .await;
  wait_for(|| fixture.master.0.frames.lock().unwrap().iter().any(|(id, frame)| {
        *id >= 2 && matches!(&frame.payload, Some(node_frame::Payload::Progress(progress)) if progress.task_id == "task-reconnect" && progress.completed)
    }), "new stream must replay cached completion").await;
  let recovered_register = fixture
    .master
    .0
    .frames
    .lock()
    .unwrap()
    .iter()
    .find_map(|(id, frame)| match &frame.payload {
      Some(node_frame::Payload::Register(register)) if *id >= 2 => Some(register.clone()),
      _ => None,
    })
    .unwrap();
  assert!(recovered_register
    .info
    .unwrap()
    .active_task_ids
    .contains(&"task-reconnect".into()));
  assert_eq!(fixture.node.health()["status"], "ok");
  fixture.data.assert_complete(&["session-reconnect"]);
  fixture.stop().await;
}
