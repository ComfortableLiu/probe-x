use anyhow::{bail, Context, Result};
use std::{
  collections::HashMap,
  env,
  net::{IpAddr, ToSocketAddrs, UdpSocket},
  path::PathBuf,
  time::Duration,
};

#[derive(Clone)]
pub struct Config {
  pub node_id: String,
  pub node_name: String,
  pub advertise_address: String,
  pub advertise_port: Option<u16>,
  pub master_url: String,
  pub health_host: String,
  pub health_port: u16,
  pub concurrency: usize,
  /// In-flight I/O slots are independent from the CPU worker budget.
  pub task_concurrency: usize,
  pub heartbeat: Duration,
  pub log_flush: Duration,
  pub detail_logs: bool,
  pub shutdown_timeout: Duration,
  pub lease_seconds: usize,
  pub values: HashMap<String, String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct NodeEndpoint {
  pub node_address: String,
  pub node_port: u16,
  pub health_host: String,
  pub health_port: u16,
}

impl Config {
  pub fn load(env_file: Option<PathBuf>) -> Result<Self> {
    let mut values: HashMap<String, String> = env::vars().collect();
    let environment = values
      .get("NODE_ENV")
      .cloned()
      .unwrap_or_else(|| "development".into());
    let paths = if let Some(file) = env_file {
      if !file.is_file() {
        bail!("指定的环境配置文件不存在");
      }
      vec![file]
    } else {
      let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
      let directories = [
        root.join("config/env"),
        root.join("../final-data-cleaning-service/config/env"),
      ];
      let names = [
        format!(".env.{environment}.local"),
        ".env.local".into(),
        format!(".env.{environment}"),
        ".env".into(),
      ];
      directories
        .into_iter()
        .flat_map(|directory| {
          names
            .clone()
            .into_iter()
            .map(move |name| directory.join(name))
        })
        .collect()
    };
    for path in paths {
      if !path.is_file() {
        continue;
      }
      for item in dotenvy::from_path_iter(path).context("无法解析环境配置文件")? {
        let (key, value) = item.context("环境配置文件中有无效条目")?;
        values.entry(key).or_insert(value);
      }
    }
    Self::from_values(values)
  }

  pub fn from_values(values: HashMap<String, String>) -> Result<Self> {
    let host = get(&values, "MASTER_HOST", "localhost");
    let master_url = if host.starts_with("https://") {
      format!(
        "{}:{}",
        host.trim_end_matches('/'),
        get(&values, "MASTER_PORT", "8105")
      )
    } else {
      format!(
        "http://{}:{}",
        host.trim_start_matches("http://").trim_end_matches('/'),
        get(&values, "MASTER_PORT", "8105")
      )
    };
    let parsed = reqwest::Url::parse(&master_url).context("总服务地址格式无效")?;
    if parsed.host_str().is_none() || !parsed.username().is_empty() || parsed.password().is_some() {
      bail!("总服务地址不能包含凭据");
    }
    let available = std::thread::available_parallelism()
      .map(usize::from)
      .unwrap_or(1);
    let concurrency = integer(&values, "RUST_CLEANING_THREADS", available, 1, 4096)?;
    let task_concurrency = integer(
      &values,
      "RUST_TASK_CONCURRENCY",
      concurrency.saturating_mul(4).min(4096),
      1,
      4096,
    )?;
    let hostname = sysinfo::System::host_name()
      .unwrap_or_else(|| "unknown".into())
      .to_lowercase();
    let hostname: String = hostname
      .chars()
      .map(|c| {
        if c.is_ascii_alphanumeric() || c == '-' {
          c
        } else {
          '-'
        }
      })
      .collect();
    let default_id = format!("rust-node-{}", hostname.trim_matches('-'));
    let node_id = get(&values, "RUST_NODE_ID", &default_id);
    let node_name = get(&values, "RUST_NODE_NAME", &node_id);
    let advertise_port = values
      .get("NODE_ADVERTISE_PORT")
      .filter(|value| !value.trim().is_empty())
      .map(|value| {
        value
          .trim()
          .parse::<u16>()
          .context("NODE_ADVERTISE_PORT 必须是 1–65535 之间的整数")
      })
      .transpose()?;
    if advertise_port == Some(0) {
      bail!("NODE_ADVERTISE_PORT 必须是 1–65535 之间的整数");
    }
    Ok(Self {
      node_id,
      node_name,
      master_url,
      advertise_address: get(&values, "NODE_ADVERTISE_ADDRESS", ""),
      advertise_port,
      health_host: get(&values, "RUST_HEALTH_HOST", "127.0.0.1"),
      health_port: integer(&values, "RUST_HEALTH_PORT", 10001, 0, u16::MAX as usize)? as u16,
      concurrency,
      task_concurrency,
      heartbeat: Duration::from_millis(
        integer(&values, "HEARTBEAT_INTERVAL_MS", 5000, 100, 600000)? as u64,
      ),
      log_flush: Duration::from_millis(integer(
        &values,
        "NODE_LOG_FLUSH_INTERVAL_MS",
        2000,
        100,
        600000,
      )? as u64),
      detail_logs: get(&values, "CLEANING_DETAIL_LOG_ENABLED", "false") == "true",
      shutdown_timeout: Duration::from_secs(integer(
        &values,
        "RUST_SHUTDOWN_TIMEOUT_SECONDS",
        60,
        1,
        3600,
      )? as u64),
      lease_seconds: integer(&values, "RUST_SLICE_LEASE_SECONDS", 120, 15, 3600)?,
      values,
    })
  }

  pub fn endpoint_for_listener(
    &self,
    health_host: String,
    health_port: u16,
  ) -> Result<NodeEndpoint> {
    if health_port == 0 {
      bail!("健康检查实际监听端口无效");
    }
    let explicit = self.advertise_address.trim();
    let mut node_address = if explicit.is_empty() {
      route_address(&self.master_url)
    } else {
      explicit.into()
    };
    if explicit.is_empty()
      && node_address
        .parse::<IpAddr>()
        .is_ok_and(|ip| ip.is_loopback())
      && health_host
        .parse::<IpAddr>()
        .is_ok_and(|ip| ip.is_loopback())
    {
      node_address = health_host.clone();
    }
    Ok(NodeEndpoint {
      node_address,
      node_port: self.advertise_port.unwrap_or(health_port),
      health_host,
      health_port,
    })
  }
}

/// UDP connect selects a local route without sending packets. No health request
/// or reachability probe is made; the master's observed peer is the fallback.
fn route_address(master_url: &str) -> String {
  let Ok(url) = reqwest::Url::parse(master_url) else {
    return String::new();
  };
  let Some(host) = url.host_str() else {
    return String::new();
  };
  let host = host.trim_start_matches('[').trim_end_matches(']');
  if host.eq_ignore_ascii_case("localhost") {
    return "127.0.0.1".into();
  }
  if let Ok(ip) = host.parse::<IpAddr>() {
    if ip.is_loopback() {
      return ip.to_string();
    }
  }
  let Ok(addresses) = (host, url.port_or_known_default().unwrap_or(8105)).to_socket_addrs() else {
    return String::new();
  };
  for target in addresses {
    let bind = if target.is_ipv4() {
      "0.0.0.0:0"
    } else {
      "[::]:0"
    };
    let Ok(socket) = UdpSocket::bind(bind) else {
      continue;
    };
    if socket.connect(target).is_err() {
      continue;
    }
    if let Ok(local) = socket.local_addr() {
      if !local.ip().is_unspecified() {
        return local.ip().to_string();
      }
    }
  }
  String::new()
}

pub fn get(values: &HashMap<String, String>, key: &str, fallback: &str) -> String {
  values
    .get(key)
    .filter(|value| !value.is_empty())
    .cloned()
    .unwrap_or_else(|| fallback.into())
}

pub fn integer(
  values: &HashMap<String, String>,
  key: &str,
  fallback: usize,
  min: usize,
  max: usize,
) -> Result<usize> {
  let Some(raw) = values.get(key).filter(|value| !value.is_empty()) else {
    return Ok(fallback);
  };
  let value = raw
    .parse::<usize>()
    .with_context(|| format!("{key} 必须为整数"))?;
  if value < min || value > max {
    bail!("{key} 必须在 {min}–{max} 之间");
  }
  Ok(value)
}

#[cfg(test)]
mod tests {
  use super::*;
  #[test]
  fn independent_identity_and_cpu_defaults() {
    let config = Config::from_values(HashMap::new()).unwrap();
    assert!(config.node_id.starts_with("rust-node-"));
    assert_eq!(config.health_port, 10001);
    assert_eq!(
      config.task_concurrency,
      config.concurrency.saturating_mul(4).min(4096)
    );
    assert_eq!(
      config.concurrency,
      std::thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1)
    );
  }
  #[test]
  fn accepts_explicit_zero_port_and_rejects_invalid_limits() {
    let mut values = HashMap::from([("RUST_HEALTH_PORT".into(), "0".into())]);
    assert_eq!(Config::from_values(values.clone()).unwrap().health_port, 0);
    values.insert("RUST_CLEANING_THREADS".into(), "0".into());
    assert!(Config::from_values(values).is_err());
  }
  #[test]
  fn io_capacity_can_change_without_growing_the_cpu_pool() {
    let config = Config::from_values(HashMap::from([
      ("RUST_CLEANING_THREADS".into(), "2".into()),
      ("RUST_TASK_CONCURRENCY".into(), "8".into()),
    ]))
    .unwrap();
    assert_eq!((config.concurrency, config.task_concurrency), (2, 8));
    assert!(Config::from_values(HashMap::from([(
      "RUST_TASK_CONCURRENCY".into(),
      "0".into()
    )]))
    .is_err());
  }
  #[test]
  fn endpoint_overrides_preserve_actual_listener_and_validate_advertised_port() {
    let config = Config::from_values(HashMap::from([
      ("NODE_ADVERTISE_ADDRESS".into(), " node.example ".into()),
      ("NODE_ADVERTISE_PORT".into(), "18000".into()),
    ]))
    .unwrap();
    let endpoint = config.endpoint_for_listener("::".into(), 23456).unwrap();
    assert_eq!(endpoint.node_address, "node.example");
    assert_eq!((endpoint.node_port, endpoint.health_port), (18000, 23456));
    assert_eq!(endpoint.health_host, "::");
    for value in ["0", "65536", "-1", "abc"] {
      assert!(Config::from_values(HashMap::from([(
        "NODE_ADVERTISE_PORT".into(),
        value.into()
      )]))
      .is_err());
    }
    assert!(
      Config::from_values(HashMap::from([("NODE_ADVERTISE_PORT".into(), " ".into())]))
        .unwrap()
        .advertise_port
        .is_none()
    );
  }
  #[test]
  fn loopback_master_and_ipv6_listener_need_no_external_probe() {
    let config = Config::from_values(HashMap::new()).unwrap();
    assert_eq!(
      config
        .endpoint_for_listener("127.0.0.1".into(), 10001)
        .unwrap()
        .node_address,
      "127.0.0.1"
    );
    assert_eq!(route_address("http://[::1]:8105"), "::1");
    assert_eq!(route_address("invalid"), "");
    assert!(config.endpoint_for_listener("127.0.0.1".into(), 0).is_err());
  }
  #[tokio::test]
  async fn zero_health_port_reports_real_assigned_listener_port() {
    let config =
      Config::from_values(HashMap::from([("RUST_HEALTH_PORT".into(), "0".into())])).unwrap();
    let listener = tokio::net::TcpListener::bind((config.health_host.as_str(), config.health_port))
      .await
      .unwrap();
    let actual = listener.local_addr().unwrap();
    let endpoint = config
      .endpoint_for_listener(actual.ip().to_string(), actual.port())
      .unwrap();
    assert!(endpoint.health_port > 0);
    assert_eq!(endpoint.node_port, endpoint.health_port);
  }
}
