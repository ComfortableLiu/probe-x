//! Bounded local telemetry. Recording counters never waits for Redis and creates
//! no tasks; one worker flushes at most two Shanghai days once per second.

use std::{
  collections::BTreeMap,
  sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, Weak,
  },
  time::{Duration, Instant},
};

use chrono::{DateTime, FixedOffset, Timelike, Utc};
use tokio::{
  sync::watch,
  task::JoinHandle,
  time::{self, MissedTickBehavior},
};

use crate::state_store::{AggregatedMetrics, StateStore};

const MINUTES_PER_DAY: usize = 1440;
const RETAINED_DAYS: usize = 2;

#[derive(Default)]
struct Buffer {
  days: BTreeMap<String, Day>,
  latest_day: Option<String>,
  last_warning: Option<Instant>,
}

struct Day {
  started_at: Option<i64>,
  count: u64,
  successful_tasks: u64,
  failed_tasks: u64,
  minutes: Box<[u64; MINUTES_PER_DAY]>,
}

impl Default for Day {
  fn default() -> Self {
    Self {
      started_at: None,
      count: 0,
      successful_tasks: 0,
      failed_tasks: 0,
      minutes: Box::new([0; MINUTES_PER_DAY]),
    }
  }
}

impl Day {
  fn into_metrics(self) -> AggregatedMetrics {
    AggregatedMetrics {
      started_at: self.started_at,
      count: self.count,
      successful_tasks: self.successful_tasks,
      failed_tasks: self.failed_tasks,
      minutes: self
        .minutes
        .iter()
        .copied()
        .enumerate()
        .filter(|(_, count)| *count > 0)
        .map(|(minute, count)| (minute as u16, count))
        .collect(),
    }
  }
  fn merge(&mut self, other: AggregatedMetrics) {
    self.started_at = match (self.started_at, other.started_at) {
      (Some(a), Some(b)) => Some(a.min(b)),
      (a, b) => a.or(b),
    };
    self.count = self.count.saturating_add(other.count);
    self.successful_tasks = self.successful_tasks.saturating_add(other.successful_tasks);
    self.failed_tasks = self.failed_tasks.saturating_add(other.failed_tasks);
    for (minute, count) in other.minutes {
      self.minutes[usize::from(minute)] = self.minutes[usize::from(minute)].saturating_add(count);
    }
  }
}

impl Buffer {
  fn day(&mut self, date: &str) -> Option<&mut Day> {
    if self
      .latest_day
      .as_deref()
      .is_none_or(|latest| date > latest)
    {
      self.latest_day = Some(date.to_owned());
    }
    // Keep the latest day and previous calendar day even after a buffer drain;
    // an old failed flush must not displace new days or grow memory indefinitely.
    let latest = chrono::NaiveDate::parse_from_str(self.latest_day.as_deref()?, "%Y-%m-%d").ok()?;
    let oldest = latest
      .pred_opt()
      .unwrap_or(latest)
      .format("%Y-%m-%d")
      .to_string();
    self.days.retain(|day, _| day.as_str() >= oldest.as_str());
    if date < oldest.as_str() {
      return None;
    }
    self.days.entry(date.to_owned()).or_default();
    while self.days.len() > RETAINED_DAYS {
      self.days.pop_first();
    }
    self.days.get_mut(date)
  }
  fn processed(&mut self, now: DateTime<Utc>, count: u64) {
    if count == 0 {
      return;
    }
    let local = now.with_timezone(&FixedOffset::east_opt(8 * 3600).unwrap());
    let date = local.format("%Y-%m-%d").to_string();
    let minute = (local.hour() * 60 + local.minute()) as usize;
    if let Some(day) = self.day(&date) {
      day.started_at = Some(
        day
          .started_at
          .map_or(now.timestamp_millis(), |at| at.min(now.timestamp_millis())),
      );
      day.count = day.count.saturating_add(count);
      day.minutes[minute] = day.minutes[minute].saturating_add(count);
    }
  }
  fn outcome(&mut self, now: DateTime<Utc>, success: bool) {
    let date = now
      .with_timezone(&FixedOffset::east_opt(8 * 3600).unwrap())
      .format("%Y-%m-%d")
      .to_string();
    if let Some(day) = self.day(&date) {
      if success {
        day.successful_tasks = day.successful_tasks.saturating_add(1);
      } else {
        day.failed_tasks = day.failed_tasks.saturating_add(1);
      }
    }
  }
  fn drain(&mut self) -> Vec<(String, AggregatedMetrics)> {
    std::mem::take(&mut self.days)
      .into_iter()
      .map(|(date, day)| (date, day.into_metrics()))
      .collect()
  }
  fn restore(&mut self, date: &str, counters: AggregatedMetrics) {
    if let Some(day) = self.day(date) {
      day.merge(counters);
    }
  }
}

struct Inner {
  buffer: Mutex<Buffer>,
  stopped: AtomicBool,
  stop: watch::Sender<bool>,
  task: Mutex<Option<JoinHandle<bool>>>,
}

#[derive(Clone)]
pub struct Metrics {
  inner: Arc<Inner>,
}

impl Metrics {
  /// Called once per node from its Tokio runtime, then cheaply cloned if needed.
  pub fn new(store: StateStore) -> Self {
    let (stop, receiver) = watch::channel(false);
    let inner = Arc::new(Inner {
      buffer: Mutex::new(Buffer::default()),
      stopped: AtomicBool::new(false),
      stop,
      task: Mutex::new(None),
    });
    let task = tokio::spawn(flusher(Arc::downgrade(&inner), store, receiver));
    *inner.task.lock().unwrap() = Some(task);
    Self { inner }
  }
  pub fn record_processed(&self, count: u64) {
    if count == 0 || self.inner.stopped.load(Ordering::Acquire) {
      return;
    }
    self
      .inner
      .buffer
      .lock()
      .unwrap()
      .processed(Utc::now(), count);
  }
  pub fn record_outcome(&self, success: bool) {
    if self.inner.stopped.load(Ordering::Acquire) {
      return;
    }
    self
      .inner
      .buffer
      .lock()
      .unwrap()
      .outcome(Utc::now(), success);
  }
  /// Stop the sole worker and make one final flush attempt, with a hard deadline.
  /// Failed final telemetry does not affect already committed cleaning tasks.
  pub async fn shutdown(&self, timeout: Duration) -> bool {
    self.inner.stopped.store(true, Ordering::Release);
    let _ = self.inner.stop.send(true);
    let task = self.inner.task.lock().unwrap().take();
    let Some(mut task) = task else {
      return self.inner.buffer.lock().unwrap().days.is_empty();
    };
    match time::timeout(timeout, &mut task).await {
      Ok(Ok(flushed)) => flushed,
      _ => {
        task.abort();
        false
      }
    }
  }
}

async fn flush(inner: &Arc<Inner>, store: &StateStore) -> bool {
  let pending = inner.buffer.lock().unwrap().drain();
  for (date, counters) in pending {
    if store.flush_metrics(&date, &counters).await.is_err() {
      let warn = {
        let mut buffer = inner.buffer.lock().unwrap();
        buffer.restore(&date, counters);
        if buffer
          .last_warning
          .is_none_or(|at| at.elapsed() >= Duration::from_secs(60))
        {
          buffer.last_warning = Some(Instant::now());
          true
        } else {
          false
        }
      };
      if warn {
        eprintln!("[Rust cleaning] 监控聚合写入失败，清洗继续执行，将重试有界计数");
      }
    }
  }
  inner.buffer.lock().unwrap().days.is_empty()
}

async fn flusher(inner: Weak<Inner>, store: StateStore, mut stop: watch::Receiver<bool>) -> bool {
  let mut timer = time::interval_at(
    time::Instant::now() + Duration::from_secs(1),
    Duration::from_secs(1),
  );
  timer.set_missed_tick_behavior(MissedTickBehavior::Skip);
  loop {
    tokio::select! {
      result = stop.changed() => {
        if result.is_err() || *stop.borrow() { break; }
      }
      _ = timer.tick() => {
        let Some(current) = inner.upgrade() else { return true; };
        flush(&current, &store).await;
      }
    }
  }
  match inner.upgrade() {
    Some(inner) => flush(&inner, &store).await,
    None => true,
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn instant(raw: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(raw)
      .unwrap()
      .with_timezone(&Utc)
  }

  #[test]
  fn aggregates_processed_outcomes_and_shanghai_minute_boundaries() {
    let mut buffer = Buffer::default();
    let before = instant("2026-10-14T15:59:59.999Z");
    let after = instant("2026-10-14T16:00:00Z");
    buffer.processed(before, 100);
    buffer.processed(before, 50);
    buffer.outcome(before, true);
    buffer.outcome(before, false);
    buffer.processed(after, 200);
    buffer.outcome(after, true);
    let mut values = buffer.drain().into_iter();
    let (date, first) = values.next().unwrap();
    assert_eq!(date, "2026-10-14");
    assert_eq!(first.count, 150);
    assert_eq!(first.started_at, Some(before.timestamp_millis()));
    assert_eq!(first.minutes, [(1439, 150)]);
    assert_eq!((first.successful_tasks, first.failed_tasks), (1, 1));
    let (date, second) = values.next().unwrap();
    assert_eq!(date, "2026-10-15");
    assert_eq!(second.count, 200);
    assert_eq!(second.minutes, [(0, 200)]);
    assert_eq!(second.successful_tasks, 1);
  }

  #[test]
  fn failed_flush_merges_with_new_counts_without_losing_minutes_or_first_timestamp() {
    let mut buffer = Buffer::default();
    let first = instant("2026-10-14T01:01:00Z");
    let second = instant("2026-10-14T01:02:00Z");
    buffer.processed(first, 10);
    buffer.outcome(first, false);
    let (date, pending) = buffer.drain().pop().unwrap();
    buffer.processed(second, 20);
    buffer.outcome(second, true);
    buffer.restore(&date, pending);
    let (_, merged) = buffer.drain().pop().unwrap();
    assert_eq!(merged.count, 30);
    assert_eq!(merged.started_at, Some(first.timestamp_millis()));
    assert_eq!(merged.minutes, [(541, 10), (542, 20)]);
    assert_eq!((merged.successful_tasks, merged.failed_tasks), (1, 1));
  }

  #[test]
  fn fixed_minute_buckets_and_two_day_retention_bound_a_prolonged_outage() {
    let mut buffer = Buffer::default();
    for day in 1..=28 {
      for minute in 0..1440 {
        let raw = format!(
          "2026-10-{day:02}T{:02}:{:02}:00+08:00",
          minute / 60,
          minute % 60
        );
        buffer.processed(instant(&raw), 1);
      }
      assert!(buffer.days.len() <= 2);
    }
    let pending = buffer.drain();
    assert_eq!(pending.len(), 2);
    assert_eq!(pending[0].0, "2026-10-27");
    assert_eq!(pending[1].0, "2026-10-28");
    assert!(pending
      .iter()
      .all(|(_, day)| day.count == 1440 && day.minutes.len() == 1440));
    buffer.restore(
      "2026-10-01",
      AggregatedMetrics {
        count: 100,
        ..Default::default()
      },
    );
    assert!(buffer.days.is_empty());
  }

  #[test]
  fn empty_and_outcome_only_samples_do_not_create_a_false_processing_start() {
    let mut buffer = Buffer::default();
    let now = instant("2026-10-14T01:00:00Z");
    buffer.processed(now, 0);
    assert!(buffer.days.is_empty());
    buffer.outcome(now, true);
    let (_, day) = buffer.drain().pop().unwrap();
    assert_eq!(day.started_at, None);
    assert_eq!(day.count, 0);
    assert!(day.minutes.is_empty());
    assert_eq!(day.successful_tasks, 1);
  }
}
