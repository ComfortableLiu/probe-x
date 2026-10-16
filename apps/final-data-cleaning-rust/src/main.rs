use anyhow::{bail, Context, Result};
use axum::{extract::State, routing::get, Json, Router};
use probe_x_final_cleaning_rust::{
  config::{get as setting, integer, Config},
  connection,
  node::Node,
  state_store::StateStore,
  storage::{ClickHouse, StorageConfig},
};
use std::{path::PathBuf, sync::Arc, time::Duration};
use tokio::sync::watch;

fn main() {
  let result = tokio::runtime::Builder::new_multi_thread()
    .enable_all()
    .build()
    .context("无法创建异步运行时")
    .and_then(|runtime| runtime.block_on(run()));
  if let Err(error) = result {
    eprintln!("Rust 清洗服务启动失败：{error}");
    std::process::exit(1);
  }
}

async fn run() -> Result<()> {
  let mut args = std::env::args().skip(1);
  let mut env_file = None;
  let mut check = false;
  while let Some(arg) = args.next() {
    match arg.as_str() {
      "--env-file" => {
        env_file = Some(PathBuf::from(
          args.next().context("--env-file 需要文件路径")?,
        ))
      }
      "--check" => check = true,
      "--help" | "-h" => {
        println!("Probe-X Rust 最终清洗节点\n用法：probe-x-final-cleaning-rust [--env-file PATH] [--check]\n--check 仅检查配置和数据库连接，不接入调度器、不启动清洗。\n默认读取 Rust 自身配置，再以原 Node 服务配置补充缺失值；环境变量优先。");
        return Ok(());
      }
      "--version" | "-V" => {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return Ok(());
      }
      _ => bail!("未知参数，请使用 --help 查看用法"),
    }
  }
  let config = Arc::new(Config::load(env_file)?);
  let values = &config.values;
  let clickhouse = ClickHouse::new(StorageConfig {
    url: setting(values, "CLICKHOUSE_HOST", "http://localhost:8123"),
    user: setting(values, "CLICKHOUSE_USER", "default"),
    password: setting(values, "CLICKHOUSE_PASSWORD", ""),
    database: setting(values, "CLICKHOUSE_DATABASE", "probe_x"),
    timeout_ms: integer(values, "CLICKHOUSE_REQUEST_TIMEOUT", 30000, 100, 3600000)? as u64,
    connection_timeout_ms: integer(values, "CLICKHOUSE_CONNECTION_TIMEOUT", 10000, 100, 600000)?
      as u64,
    batch_size: integer(values, "RUST_BATCH_SIZE", 1000, 1, 10000)?,
    max_batch_bytes: integer(
      values,
      "RUST_MAX_BATCH_BYTES",
      8 * 1024 * 1024,
      1024,
      256 * 1024 * 1024,
    )?,
    max_event_bytes: integer(
      values,
      "RUST_MAX_EVENT_BYTES",
      1024 * 1024,
      1024,
      16 * 1024 * 1024,
    )?,
    reject_unauthorized: setting(values, "CLICKHOUSE_REJECT_UNAUTHORIZED", "true") != "false",
    compression: setting(values, "CLICKHOUSE_COMPRESSION", "true") != "false",
    write_batch_wait_ms: integer(values, "RUST_WRITE_BATCH_WAIT_MS", 10, 0, 1000)? as u64,
  })?;
  clickhouse.check().await?;
  let store = StateStore::connect(&config).await?;
  if check {
    println!("Rust 清洗配置、ClickHouse 和 Redis 连接检查通过（未接入调度器）");
    return Ok(());
  }
  let node = Node::new(config.clone(), store, clickhouse)?;
  let listener = tokio::net::TcpListener::bind((config.health_host.as_str(), config.health_port))
    .await
    .context("无法监听 Rust 健康检查端口")?;
  let endpoint = listener.local_addr()?;
  let port = endpoint.port();
  node.set_health_endpoint(endpoint.ip().to_string(), port)?;
  let (stop, shutdown) = watch::channel(false);
  let connection = tokio::spawn(connection::run(node.clone(), shutdown.clone()));
  let health = Router::new()
    .route(
      "/health",
      get(|State(node): State<Arc<Node>>| async move { Json(node.health()) }),
    )
    .with_state(node.clone());
  let health_stop = shutdown.clone();
  let health_server = tokio::spawn(async move {
    axum::serve(listener, health)
      .with_graceful_shutdown(async move {
        let mut receiver = health_stop;
        while !*receiver.borrow() && receiver.changed().await.is_ok() {}
      })
      .await
  });
  node.log(
    "log",
    &format!(
      "Rust 清洗节点已启动，CPU线程 {}，并发任务容量 {}，健康检查端口 {port}",
      config.concurrency, config.task_concurrency
    ),
  );
  shutdown_signal().await?;
  node.begin_shutdown();
  node.log("log", "停止接收新任务，等待已接受任务落定");
  if !node.drain(config.shutdown_timeout).await {
    node.log("warn", "关闭等待超时，未完成切片保留供后续重试");
  }
  if !node.flush_metrics(Duration::from_secs(5)).await {
    node.log("warn", "退出时监控指标刷新未完成");
  }
  // Give the transport a short opportunity to flush terminal progress before closing.
  tokio::time::sleep(Duration::from_millis(100)).await;
  let _ = stop.send(true);
  let _ = connection.await;
  health_server.await.context("健康检查服务退出异常")??;
  Ok(())
}

async fn shutdown_signal() -> Result<()> {
  #[cfg(unix)]
  {
    use tokio::signal::unix::{signal, SignalKind};
    let mut term = signal(SignalKind::terminate()).context("无法安装退出信号处理器")?;
    tokio::select! { result = tokio::signal::ctrl_c() => result.context("无法监听退出信号")?, _ = term.recv() => {} }
  }
  #[cfg(not(unix))]
  {
    tokio::signal::ctrl_c().await.context("无法监听退出信号")?;
  }
  Ok(())
}
