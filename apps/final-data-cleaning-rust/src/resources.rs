use std::time::Instant;

use sysinfo::System;

use crate::proto::NodeInfo;

pub struct ResourceMonitor {
  system: System,
  cpu_at: Instant,
  cpu_sampled: bool,
  previous_network: Option<(u64, Instant)>,
}

impl ResourceMonitor {
  pub fn new() -> Self {
    let mut system = System::new();
    system.refresh_memory();
    system.refresh_cpu_usage();
    Self {
      system,
      cpu_at: Instant::now(),
      cpu_sampled: false,
      previous_network: None,
    }
  }

  pub fn sample(&mut self, mut task_ids: Vec<String>, capacity: usize) -> NodeInfo {
    task_ids.retain(|id| !id.is_empty());
    self.system.refresh_memory();
    let now = Instant::now();
    if now.duration_since(self.cpu_at) >= sysinfo::MINIMUM_CPU_UPDATE_INTERVAL {
      self.system.refresh_cpu_usage();
      self.cpu_at = now;
      self.cpu_sampled = sysinfo::IS_SUPPORTED_SYSTEM && !self.system.cpus().is_empty();
    }
    let network = network_bytes();
    let rate = match (network, self.previous_network) {
      (Some(current), Some((previous, at))) if current >= previous && now > at => {
        Some((current - previous) as f64 / now.duration_since(at).as_secs_f64())
      }
      _ => None,
    };
    self.previous_network = network.map(|bytes| (bytes, now));
    let load = System::load_average().one;
    let cpu_usage = f64::from(self.system.global_cpu_usage());
    NodeInfo {
      cpu_count: i32::try_from(self.system.cpus().len()).unwrap_or(i32::MAX),
      memory_size: megabytes(self.system.total_memory()),
      available_memory_size: megabytes(self.system.available_memory()),
      available: true,
      busy: !task_ids.is_empty(),
      busy_task_id: task_ids.first().cloned().unwrap_or_default(),
      resource_sampled: self.cpu_sampled,
      cpu_usage: if self.cpu_sampled && cpu_usage.is_finite() {
        cpu_usage.clamp(0.0, 100.0)
      } else {
        0.0
      },
      load_average: if load.is_finite() { load.max(0.0) } else { 0.0 },
      network_sampled: rate.is_some(),
      network_bytes_per_second: rate.unwrap_or(0.0),
      task_capacity: i32::try_from(capacity.max(1)).unwrap_or(i32::MAX),
      active_task_ids: task_ids,
    }
  }
}

impl Default for ResourceMonitor {
  fn default() -> Self {
    Self::new()
  }
}

fn megabytes(bytes: u64) -> i32 {
  let megabytes = bytes.saturating_add(512 * 1024) / (1024 * 1024);
  i32::try_from(megabytes).unwrap_or(i32::MAX)
}

#[cfg(target_os = "linux")]
fn network_bytes() -> Option<u64> {
  parse_network_bytes(&std::fs::read_to_string("/proc/net/dev").ok()?)
}

#[cfg(not(target_os = "linux"))]
fn network_bytes() -> Option<u64> {
  None
}

#[cfg(any(target_os = "linux", test))]
fn parse_network_bytes(input: &str) -> Option<u64> {
  let mut total = 0_u64;
  let mut found_interface = false;
  for line in input.lines().skip(2).filter(|line| !line.trim().is_empty()) {
    let (name, counters) = line.split_once(':')?;
    found_interface = true;
    if name.trim() == "lo" {
      continue;
    }
    let counters: Vec<_> = counters.split_whitespace().collect();
    total = total.checked_add(counters.first()?.parse::<u64>().ok()?)?;
    total = total.checked_add(counters.get(8)?.parse::<u64>().ok()?)?;
  }
  found_interface.then_some(total)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn reads_linux_receive_and_send_counters_without_loopback() {
    let counters = "Inter-| Receive | Transmit\n face | bytes | bytes\n lo: 100 0 0 0 0 0 0 0 200 0 0 0 0 0 0 0\n eth0: 300 0 0 0 0 0 0 0 400 0 0 0 0 0 0 0\n eth1: 500 0 0 0 0 0 0 0 600 0 0 0 0 0 0 0\n";
    assert_eq!(parse_network_bytes(counters), Some(1800));
    assert_eq!(parse_network_bytes("header\nheader\n"), None);
    assert_eq!(parse_network_bytes("header\nheader\neth0: bad data"), None);
  }

  #[test]
  fn first_sample_is_explicitly_unavailable_and_capacity_is_preserved() {
    let mut monitor = ResourceMonitor::new();
    let info = monitor.sample(vec!["task-a".into(), "".into(), "task-b".into()], 4);
    assert!(!info.resource_sampled);
    assert!(!info.network_sampled);
    assert_eq!(info.task_capacity, 4);
    assert!(info.busy);
    assert_eq!(info.busy_task_id, "task-a");
    assert_eq!(info.active_task_ids, ["task-a", "task-b"]);
    #[cfg(not(target_os = "linux"))]
    assert!(!monitor.sample(Vec::new(), 1).network_sampled);
  }
}
