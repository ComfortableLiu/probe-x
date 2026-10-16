//! Bounded ClickHouse HTTP I/O. No session-wide event or deduplication set is retained.
//!
//! The caller owns the durable slice marker: mark a slice incomplete before the first
//! insert, and clear it only after the input stream and both result tables finish.
//! A failed or cancelled stream must never be reported as a completed slice.

use crate::attribution::{Attribution, Event};
use anyhow::{anyhow, bail, Result};
use bytes::Bytes;
use flate2::{write::GzEncoder, Compression};
use futures_util::{Stream, StreamExt};
use reqwest::{Client, Response, Url};
use serde::Serialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::io::Write;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, oneshot, OnceCell};

#[derive(Clone)]
pub struct StorageConfig {
  pub url: String,
  pub user: String,
  pub password: String,
  pub database: String,
  /// An idle read timeout, rather than a timeout for the entire long-lived stream.
  pub timeout_ms: u64,
  pub connection_timeout_ms: u64,
  pub batch_size: usize,
  pub max_batch_bytes: usize,
  pub max_event_bytes: usize,
  pub reject_unauthorized: bool,
  pub compression: bool,
  /// Maximum time to collect concurrent callers' already-deduplicated output.
  /// Zero disables aggregation, while retaining the bounded write queue.
  pub write_batch_wait_ms: u64,
}

#[derive(Clone)]
pub struct ClickHouse {
  transport: Arc<HttpTransport>,
  inserts: Arc<InsertWriters>,
}

struct HttpTransport {
  client: Client,
  config: StorageConfig,
  url: Url,
}

#[derive(Default)]
struct InsertWriters {
  events: OnceCell<mpsc::Sender<PendingInsert>>,
  attributions: OnceCell<mpsc::Sender<PendingInsert>>,
}

struct PendingInsert {
  payload: String,
  rows: usize,
  complete: oneshot::Sender<Result<()>>,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct WriteCounts {
  pub events: u64,
  pub attributions: u64,
}

type ByteStream = Pin<Box<dyn Stream<Item = Result<Bytes>> + Send>>;

/// Pull-based stream: the next batch is not read until the caller has capacity.
pub struct EventBatches {
  stream: ByteStream,
  current: Bytes,
  offset: usize,
  line: Vec<u8>,
  lookahead: Option<(Event, usize)>,
  eof: bool,
  batch_size: usize,
  max_batch_bytes: usize,
  max_event_bytes: usize,
}

impl EventBatches {
  fn new(stream: ByteStream, config: &StorageConfig) -> Self {
    Self {
      stream,
      current: Bytes::new(),
      offset: 0,
      line: Vec::new(),
      lookahead: None,
      eof: false,
      batch_size: config.batch_size,
      max_batch_bytes: config.max_batch_bytes,
      max_event_bytes: config.max_event_bytes,
    }
  }

  async fn next_line(&mut self) -> Result<Option<Vec<u8>>> {
    loop {
      if self.offset < self.current.len() {
        let remaining = &self.current[self.offset..];
        let newline = remaining.iter().position(|byte| *byte == b'\n');
        let consumed = newline.unwrap_or(remaining.len());
        if self.line.len().saturating_add(consumed) > self.max_event_bytes {
          bail!("ClickHouse row exceeds configured maximum size");
        }
        self.line.extend_from_slice(&remaining[..consumed]);
        self.offset += consumed;
        if newline.is_some() {
          self.offset += 1;
          let mut line = std::mem::take(&mut self.line);
          if line.last() == Some(&b'\r') {
            line.pop();
          }
          if !line.is_empty() {
            return Ok(Some(line));
          }
          continue;
        }
      }
      if self.eof {
        return if self.line.is_empty() {
          Ok(None)
        } else {
          Ok(Some(std::mem::take(&mut self.line)))
        };
      }
      match self.stream.next().await {
        Some(Ok(chunk)) => {
          self.current = chunk;
          self.offset = 0;
        }
        Some(Err(error)) => return Err(error),
        None => self.eof = true,
      }
    }
  }

  pub async fn next_batch(&mut self) -> Result<Option<Vec<Event>>> {
    let mut batch = Vec::with_capacity(self.batch_size);
    let mut bytes = 0usize;
    loop {
      let next = if let Some(row) = self.lookahead.take() {
        Some(row)
      } else {
        match self.next_line().await? {
          Some(line) => {
            let size = line.len();
            let event = serde_json::from_slice::<Event>(&line)
              .map_err(|_| anyhow!("ClickHouse returned invalid JSONEachRow data"))?;
            Some((event, size))
          }
          None => None,
        }
      };
      let Some((event, size)) = next else {
        return Ok((!batch.is_empty()).then_some(batch));
      };
      if !batch.is_empty() && bytes.saturating_add(size) > self.max_batch_bytes {
        self.lookahead = Some((event, size));
        return Ok(Some(batch));
      }
      bytes += size;
      batch.push(event);
      if batch.len() >= self.batch_size || bytes >= self.max_batch_bytes {
        return Ok(Some(batch));
      }
    }
  }
}

impl ClickHouse {
  pub fn new(config: StorageConfig) -> Result<Self> {
    if config.batch_size == 0
      || config.max_event_bytes == 0
      || config.max_batch_bytes < config.max_event_bytes
      || config.timeout_ms == 0
      || config.connection_timeout_ms == 0
      || config.write_batch_wait_ms > 60000
    {
      bail!("Invalid ClickHouse batch or timeout configuration");
    }
    let url = Url::parse(&config.url).map_err(|_| anyhow!("Invalid ClickHouse HTTP endpoint"))?;
    if !matches!(url.scheme(), "http" | "https")
      || url.host_str().is_none()
      || !url.username().is_empty()
      || url.password().is_some()
      || url.fragment().is_some()
    {
      bail!("ClickHouse endpoint must be HTTP(S), without embedded credentials or fragments");
    }
    let client = Client::builder()
      .connect_timeout(Duration::from_millis(config.connection_timeout_ms))
      .read_timeout(Duration::from_millis(config.timeout_ms))
      .danger_accept_invalid_certs(!config.reject_unauthorized)
      .gzip(config.compression)
      .build()
      .map_err(|_| anyhow!("Could not initialize ClickHouse HTTP client"))?;
    Ok(Self {
      transport: Arc::new(HttpTransport {
        client,
        config,
        url,
      }),
      inserts: Arc::new(InsertWriters::default()),
    })
  }

  /// Test connectivity without creating tables or starting a cleaning task.
  pub async fn check(&self) -> Result<()> {
    let mut rows = self
      .query(
        "SELECT {probe:UInt8} AS ok FORMAT JSONEachRow",
        &[("probe", "1".to_owned())],
      )
      .await?;
    let batch = rows
      .next_batch()
      .await?
      .ok_or_else(|| anyhow!("ClickHouse connectivity check returned no result"))?;
    if batch
      .first()
      .and_then(|row| row.get("ok"))
      .and_then(Value::as_u64)
      != Some(1)
    {
      bail!("ClickHouse connectivity check returned an unexpected result");
    }
    Ok(())
  }

  pub async fn count_slice(&self, date: &str, session_id: &str) -> Result<u64> {
    validate_date(date)?;
    let mut rows = self
      .query(
        "SELECT count() AS count FROM event_log \
                 WHERE toDate(`$service_time`) = {queryDate: Date} \
                 AND `$session_id` = {sessionId: String} FORMAT JSONEachRow",
        &[
          ("queryDate", date.to_owned()),
          ("sessionId", session_id.to_owned()),
        ],
      )
      .await?;
    let first = rows
      .next_batch()
      .await?
      .and_then(|batch| batch.into_iter().next())
      .ok_or_else(|| anyhow!("ClickHouse count query returned no result"))?;
    parse_u64(first.get("count"))
  }

  pub async fn read_slice(&self, date: &str, session_id: &str) -> Result<EventBatches> {
    validate_date(date)?;
    self
      .query(
        // No ORDER BY: the attribution algorithm is event-local. Avoid an entire
        // oversized session being sorted on the server before its first batch.
        "SELECT * FROM event_log \
             WHERE toDate(`$service_time`) = {queryDate: Date} \
             AND `$session_id` = {sessionId: String} FORMAT JSONEachRow",
        &[
          ("queryDate", date.to_owned()),
          ("sessionId", session_id.to_owned()),
        ],
      )
      .await
  }

  async fn query(&self, sql: &str, params: &[(&str, String)]) -> Result<EventBatches> {
    let response = self.transport.request(sql.to_owned(), params).await?;
    // Deliberately replace reqwest's errors: they can contain a credentialed URL.
    // ClickHouse response bodies can echo SQL parameters and source event values.
    let stream = response
      .bytes_stream()
      .map(|result| result.map_err(|_| anyhow!("ClickHouse response stream was interrupted")));
    Ok(EventBatches::new(Box::pin(stream), &self.transport.config))
  }

  async fn enqueue_insert(&self, table: &'static str, payload: String, rows: usize) -> Result<()> {
    if rows == 0
      || rows > self.transport.config.batch_size
      || payload.len() > self.transport.config.max_batch_bytes
    {
      bail!("Cleaning insert exceeds configured batch limits");
    }
    let cell = match table {
      "final_event_log" => &self.inserts.events,
      "event_attribution" => &self.inserts.attributions,
      _ => bail!("Invalid cleaning output table"),
    };
    let sender = cell
      .get_or_init(|| async {
        // Each job is at most one bounded output batch. Producers wait for queue
        // capacity and then durable acknowledgement; there is no detached backlog.
        let (sender, receiver) = mpsc::channel(2);
        tokio::spawn(run_insert_writer(
          Arc::clone(&self.transport),
          table,
          receiver,
        ));
        sender
      })
      .await;
    let (complete, confirmed) = oneshot::channel();
    sender
      .send(PendingInsert {
        payload,
        rows,
        complete,
      })
      .await
      .map_err(|_| anyhow!("ClickHouse shared writer is unavailable"))?;
    confirmed
      .await
      .map_err(|_| anyhow!("ClickHouse shared writer stopped before acknowledging insertion"))?
  }

  /// The deduplication query contains only IDs in this input batch.
  pub async fn write_events(&self, date: &str, session_id: &str, events: &[Event]) -> Result<u64> {
    if events.is_empty() {
      return Ok(0);
    }
    validate_date(date)?;
    let event_ids = events
      .iter()
      .map(|event| required_string(event.get("$event_id")))
      .collect::<Result<Vec<_>>>()?;
    // The shared final table is sorted by service_time first. Restrict each
    // lookup to the current batch's time span instead of rescanning a whole day.
    let time_bounds = event_time_bounds(events);
    let time_filter = if time_bounds.is_some() {
      " AND `$service_time` >= {minTime: DateTime64(3)} AND `$service_time` <= {maxTime: DateTime64(3)} "
    } else {
      " "
    };
    let sql = format!(
            "SELECT DISTINCT `$event_id` FROM final_event_log \
             WHERE toDate(`$service_time`) = {{queryDate: Date}} \
             AND `$session_id` = {{sessionId: String}} \
             {time_filter} \
             AND `$event_id` IN (SELECT arrayJoin(JSONExtract({{eventIds: String}}, 'Array(String)'))) \
             FORMAT JSONEachRow"
        );
    let mut existing_ids = HashSet::new();
    for ids in parameter_batches(
      event_ids.iter(),
      self.transport.config.batch_size,
      self.transport.config.max_batch_bytes,
    )? {
      let mut params = vec![
        ("queryDate", date.to_owned()),
        ("sessionId", session_id.to_owned()),
        ("eventIds", ids),
      ];
      if let Some((min, max)) = time_bounds {
        params.push(("minTime", min.to_owned()));
        params.push(("maxTime", max.to_owned()));
      }
      let mut existing = self.query(&sql, &params).await?;
      while let Some(batch) = existing.next_batch().await? {
        for row in batch {
          existing_ids.insert(required_string(row.get("$event_id"))?.to_owned());
        }
      }
    }
    let pending = events.iter().filter(|event| {
      event
        .get("$event_id")
        .and_then(Value::as_str)
        .is_some_and(|id| !existing_ids.contains(id))
    });
    self.insert_rows("final_event_log", pending).await
  }

  /// Pass complete events' attribution rows together. This preserves multiplicity
  /// when different source keys camel-case to the same key and value.
  pub async fn write_attributions(
    &self,
    date: &str,
    session_id: &str,
    attributions: &[Attribution],
  ) -> Result<u64> {
    if attributions.is_empty() {
      return Ok(0);
    }
    validate_date(date)?;
    let keys = attributions
      .iter()
      .map(|row| {
        Ok((
          required_string(Some(&row.event_id))?,
          row.attr_key.as_str(),
          row.attr_value.as_str(),
        ))
      })
      .collect::<Result<Vec<_>>>()?;
    let mut remaining = HashMap::<(String, String, String), u64>::new();
    for encoded in parameter_batches(
      keys.iter(),
      self.transport.config.batch_size,
      self.transport.config.max_batch_bytes,
    )? {
      let mut existing = self
            .query(
                "SELECT event_id, attr_key, attr_value, count() AS rows FROM event_attribution \
                 WHERE toDate(event_time) = {queryDate: Date} AND session_id = {sessionId: String} \
                 AND tuple(event_id, attr_key, attr_value) IN \
                 (SELECT arrayJoin(JSONExtract({attributionKeys: String}, 'Array(Tuple(String,String,String))'))) \
                 GROUP BY event_id, attr_key, attr_value FORMAT JSONEachRow",
                &[
                    ("queryDate", date.to_owned()),
                    ("sessionId", session_id.to_owned()),
                    ("attributionKeys", encoded),
                ],
            )
            .await?;
      while let Some(batch) = existing.next_batch().await? {
        for row in batch {
          let key = (
            required_string(row.get("event_id"))?.to_owned(),
            required_string(row.get("attr_key"))?.to_owned(),
            required_string(row.get("attr_value"))?.to_owned(),
          );
          // The same tuple can occur in multiple lookup batches. The
          // database count is the same observation, never sum it twice.
          remaining.insert(key, parse_u64(row.get("rows"))?);
        }
      }
    }
    let pending = attributions.iter().filter(|row| {
      let key = (
        row.event_id.as_str().unwrap_or_default().to_owned(),
        row.attr_key.clone(),
        row.attr_value.clone(),
      );
      match remaining.get_mut(&key) {
        Some(count) if *count > 0 => {
          *count -= 1;
          false
        }
        _ => true,
      }
    });
    self.insert_rows("event_attribution", pending).await
  }

  /// Both write attempts settle before returning, so a retry cannot race a write
  /// still running in the previous attempt. No atomicity between the tables is assumed.
  pub async fn write_batch(
    &self,
    date: &str,
    session_id: &str,
    events: &[Event],
    attributions: &[Attribution],
  ) -> Result<WriteCounts> {
    let (events, attributions) = tokio::join!(
      self.write_events(date, session_id, events),
      self.write_attributions(date, session_id, attributions),
    );
    Ok(WriteCounts {
      events: events?,
      attributions: attributions?,
    })
  }

  async fn insert_rows<'a, T: Serialize + 'a>(
    &self,
    table: &'static str,
    rows: impl Iterator<Item = &'a T>,
  ) -> Result<u64> {
    // Table names are internal constants, never request inputs.
    if !matches!(table, "final_event_log" | "event_attribution") {
      bail!("Invalid cleaning output table");
    }
    let mut body = String::new();
    let mut batch_count = 0usize;
    let mut inserted = 0u64;
    for row in rows {
      let encoded = serde_json::to_string(row)
        .map_err(|_| anyhow!("Could not serialize cleaning output row"))?;
      if encoded.len() > self.transport.config.max_event_bytes {
        bail!("Cleaning output row exceeds configured maximum size");
      }
      if encoded.len().saturating_add(1) > self.transport.config.max_batch_bytes {
        bail!("Cleaning output row exceeds configured batch byte limit");
      }
      if batch_count > 0
        && (batch_count >= self.transport.config.batch_size
          || body.len().saturating_add(encoded.len() + 1) > self.transport.config.max_batch_bytes)
      {
        self
          .enqueue_insert(table, std::mem::take(&mut body), batch_count)
          .await?;
        inserted += batch_count as u64;
        batch_count = 0;
      }
      body.push_str(&encoded);
      body.push('\n');
      batch_count += 1;
    }
    if batch_count > 0 {
      self.enqueue_insert(table, body, batch_count).await?;
      inserted += batch_count as u64;
    }
    Ok(inserted)
  }
}

/// A writer holds only the transport, not its queue sender, so dropping the
/// ClickHouse handle closes the channel and lets the background task terminate.
async fn run_insert_writer(
  transport: Arc<HttpTransport>,
  table: &'static str,
  mut receiver: mpsc::Receiver<PendingInsert>,
) {
  let mut pending: Option<PendingInsert> = None;
  loop {
    let first = match pending.take() {
      Some(job) => job,
      None => match receiver.recv().await {
        Some(job) => job,
        None => return,
      },
    };
    if first.complete.is_closed() {
      continue;
    }
    let mut body = first.payload;
    let mut rows = first.rows;
    let mut acknowledgements = vec![first.complete];
    let deadline =
      tokio::time::Instant::now() + Duration::from_millis(transport.config.write_batch_wait_ms);
    while transport.config.write_batch_wait_ms > 0
      && rows < transport.config.batch_size
      && body.len() < transport.config.max_batch_bytes
    {
      let next = match tokio::time::timeout_at(deadline, receiver.recv()).await {
        Ok(Some(job)) => job,
        _ => break,
      };
      if next.complete.is_closed() {
        continue;
      }
      if rows.saturating_add(next.rows) > transport.config.batch_size
        || body.len().saturating_add(next.payload.len()) > transport.config.max_batch_bytes
      {
        pending = Some(next);
        break;
      }
      body.push_str(&next.payload);
      rows += next.rows;
      acknowledgements.push(next.complete);
    }
    body.insert_str(0, &format!("INSERT INTO {table} FORMAT JSONEachRow\n"));
    let result = transport.finish_insert(body).await;
    for complete in acknowledgements {
      let reply = result
        .as_ref()
        .map(|_| ())
        .map_err(|error| anyhow!("{error}"));
      let _ = complete.send(reply);
    }
  }
}

impl HttpTransport {
  async fn request(&self, body: String, params: &[(&str, String)]) -> Result<Response> {
    let mut query = vec![
      ("database".to_owned(), self.config.database.clone()),
      (
        "output_format_json_quote_64bit_integers".to_owned(),
        "0".to_owned(),
      ),
      (
        "date_time_input_format".to_owned(),
        "best_effort".to_owned(),
      ),
      ("wait_end_of_query".to_owned(), "0".to_owned()),
    ];
    if self.config.compression {
      query.push(("enable_http_compression".to_owned(), "1".to_owned()));
    }
    let request = self
      .client
      .post(self.url.clone())
      .basic_auth(&self.config.user, Some(&self.config.password))
      .query(&query);
    let request = if params.is_empty() {
      let request = request.header(reqwest::header::CONTENT_TYPE, "text/plain; charset=utf-8");
      if self.config.compression {
        // Large insert compression belongs on the blocking pool. Small inserts
        // avoid a separate thread handoff, which would dominate their CPU cost.
        let compressed = if body.len() >= 64 * 1024 {
          tokio::task::spawn_blocking(move || gzip_body(body))
            .await
            .map_err(|_| anyhow!("ClickHouse request compression worker stopped"))??
        } else {
          gzip_body(body)?
        };
        request
          .header(reqwest::header::CONTENT_ENCODING, "gzip")
          .body(compressed)
      } else {
        request.body(body)
      }
    } else {
      // Parameterized queries stay multipart to avoid URI size limits. Responses
      // are compressed; the much larger NDJSON INSERT bodies are gzip-encoded.
      let mut form = reqwest::multipart::Form::new().text("query", body);
      for (key, value) in params {
        form = form.text(format!("param_{key}"), value.clone());
      }
      request.multipart(form)
    };
    let response = request
      .send()
      .await
      .map_err(|_| anyhow!("ClickHouse HTTP request failed"))?;
    if !response.status().is_success() {
      bail!("ClickHouse returned HTTP {}", response.status().as_u16());
    }
    if response
      .headers()
      .get("x-clickhouse-exception-code")
      .is_some_and(|code| code.as_bytes() != b"0")
    {
      bail!("ClickHouse reported a query exception");
    }
    Ok(response)
  }

  async fn finish_insert(&self, body: String) -> Result<()> {
    let response = self.request(body, &[]).await?;
    // Consume the response to detect HTTP body failures and release its connection.
    // Success should have an empty body; a body may contain a late ClickHouse error.
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
      let chunk = chunk.map_err(|_| anyhow!("ClickHouse insert response was interrupted"))?;
      if chunk.iter().any(|byte| !byte.is_ascii_whitespace()) {
        bail!("ClickHouse insert returned an unexpected response body");
      }
    }
    Ok(())
  }
}

fn gzip_body(body: String) -> Result<Vec<u8>> {
  let mut encoder = GzEncoder::new(Vec::new(), Compression::fast());
  encoder
    .write_all(body.as_bytes())
    .map_err(|_| anyhow!("Could not compress ClickHouse request"))?;
  encoder
    .finish()
    .map_err(|_| anyhow!("Could not finish ClickHouse request compression"))
}

/// Keep even a huge event's deduplication parameters in bounded requests.
fn parameter_batches<'a, T: Serialize + 'a>(
  rows: impl Iterator<Item = &'a T>,
  max_rows: usize,
  max_bytes: usize,
) -> Result<Vec<String>> {
  let mut batches = Vec::new();
  let mut body = String::from("[");
  let mut count = 0;
  for row in rows {
    let encoded = serde_json::to_string(row)
      .map_err(|_| anyhow!("Could not encode ClickHouse query parameters"))?;
    if encoded.len() + 2 > max_bytes {
      bail!("Cleaning identifier or attribution value exceeds query parameter size limit");
    }
    if count > 0 && (count >= max_rows || body.len() + encoded.len() + 2 > max_bytes) {
      body.push(']');
      batches.push(std::mem::replace(&mut body, String::from("[")));
      count = 0;
    }
    if count > 0 {
      body.push(',');
    }
    body.push_str(&encoded);
    count += 1;
  }
  if count > 0 {
    body.push(']');
    batches.push(body);
  }
  Ok(batches)
}

fn required_string(value: Option<&Value>) -> Result<&str> {
  value
    .and_then(Value::as_str)
    .ok_or_else(|| anyhow!("ClickHouse row has an invalid string identifier"))
}

fn event_time_bounds(events: &[Event]) -> Option<(&str, &str)> {
  let mut min: Option<&str> = None;
  let mut max: Option<&str> = None;
  for event in events {
    let time = event.get("$service_time")?.as_str()?;
    // Only compare the canonical, fixed-width server representation. Other
    // valid input encodings still work; they simply use the date-only lookup.
    if time.len() != 23
      || chrono::NaiveDateTime::parse_from_str(time, "%Y-%m-%d %H:%M:%S%.3f").is_err()
    {
      return None;
    }
    min = Some(min.map_or(time, |value| value.min(time)));
    max = Some(max.map_or(time, |value| value.max(time)));
  }
  min.zip(max)
}

fn parse_u64(value: Option<&Value>) -> Result<u64> {
  match value {
    Some(Value::Number(value)) => value.as_u64(),
    Some(Value::String(value)) => value.parse().ok(),
    _ => None,
  }
  .ok_or_else(|| anyhow!("ClickHouse returned an invalid unsigned count"))
}

fn validate_date(date: &str) -> Result<()> {
  if date.len() != 10 || chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").is_err() {
    bail!("Cleaning date must be a valid YYYY-MM-DD value");
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;
  use futures_util::stream;
  use serde_json::json;

  fn config() -> StorageConfig {
    StorageConfig {
      url: "http://127.0.0.1:8123".into(),
      user: "test-user".into(),
      password: "test-password".into(),
      database: "probe_x".into(),
      timeout_ms: 1000,
      connection_timeout_ms: 1000,
      batch_size: 2,
      max_batch_bytes: 128,
      max_event_bytes: 128,
      reject_unauthorized: true,
      compression: false,
      write_batch_wait_ms: 0,
    }
  }

  fn batches(chunks: Vec<Result<Bytes>>, config: &StorageConfig) -> EventBatches {
    EventBatches::new(Box::pin(stream::iter(chunks)), config)
  }

  #[tokio::test]
  async fn parses_arbitrary_chunk_boundaries_unicode_and_final_unterminated_row() {
    let mut input = batches(
      vec![
        Ok(Bytes::from_static(b"\n{\"id\":1,\"label\":\"")),
        Ok(Bytes::from_static(&[0xe4, 0xbd])),
        Ok(Bytes::from_static(&[0xa0, 0xe5, 0xa5, 0xbd])),
        Ok(Bytes::from_static(b"\"}\r\n{\"id\":2}\n{\"id\":3}")),
      ],
      &config(),
    );
    let first = input.next_batch().await.unwrap().unwrap();
    assert_eq!(first.len(), 2);
    assert_eq!(first[0]["label"], "你好");
    assert_eq!(input.next_batch().await.unwrap().unwrap()[0]["id"], 3);
    assert!(input.next_batch().await.unwrap().is_none());
  }

  #[tokio::test]
  async fn preserves_u64_datetime_and_unrecognized_wide_columns() {
    let row = br#"{"$uid":18446744073709551615,"$service_time":"2026-10-15 12:34:56.789","unrecognized":{"a":[true,null,1]}}"#;
    let mut settings = config();
    settings.max_event_bytes = 512;
    settings.max_batch_bytes = 512;
    let mut input = batches(vec![Ok(Bytes::from_static(row))], &settings);
    let batch = input.next_batch().await.unwrap().unwrap();
    assert_eq!(batch[0]["$uid"].as_u64(), Some(u64::MAX));
    assert_eq!(batch[0]["$service_time"], "2026-10-15 12:34:56.789");
    assert_eq!(batch[0]["unrecognized"], json!({"a": [true, null, 1]}));
    assert!(serde_json::to_string(&batch[0])
      .unwrap()
      .contains("18446744073709551615"));
  }

  #[tokio::test]
  async fn bounds_batches_by_bytes_in_addition_to_row_count() {
    let mut settings = config();
    settings.batch_size = 100;
    settings.max_event_bytes = 16;
    settings.max_batch_bytes = 20;
    let mut input = batches(
      vec![Ok(Bytes::from_static(
        b"{\"id\":1}\n{\"id\":2}\n{\"id\":3}\n",
      ))],
      &settings,
    );
    assert_eq!(input.next_batch().await.unwrap().unwrap().len(), 2);
    assert_eq!(input.next_batch().await.unwrap().unwrap().len(), 1);
    assert!(input.next_batch().await.unwrap().is_none());
  }

  #[tokio::test]
  async fn rejects_oversize_rows_invalid_json_and_midstream_errors() {
    let mut settings = config();
    settings.max_event_bytes = 8;
    let mut too_big = batches(
      vec![Ok(Bytes::from_static(b"{\"long\":\"value\"}"))],
      &settings,
    );
    assert!(too_big
      .next_batch()
      .await
      .unwrap_err()
      .to_string()
      .contains("maximum size"));
    let mut invalid = batches(vec![Ok(Bytes::from_static(b"not-json\n"))], &config());
    assert_eq!(
      invalid.next_batch().await.unwrap_err().to_string(),
      "ClickHouse returned invalid JSONEachRow data"
    );
    let mut interrupted = batches(
      vec![
        Ok(Bytes::from_static(b"{\"id\":")),
        Err(anyhow!("interrupted")),
      ],
      &config(),
    );
    assert!(interrupted.next_batch().await.is_err());
  }

  #[tokio::test]
  async fn next_batch_does_not_poll_future_rows_without_capacity() {
    use std::sync::{
      atomic::{AtomicUsize, Ordering},
      Arc,
    };
    let polled = Arc::new(AtomicUsize::new(0));
    let counter = Arc::clone(&polled);
    let source = stream::iter((0..10000).map(move |index| {
      counter.fetch_add(1, Ordering::SeqCst);
      Ok(Bytes::from(format!("{{\"id\":{index}}}\n")))
    }));
    let mut input = EventBatches::new(Box::pin(source), &config());
    assert_eq!(input.next_batch().await.unwrap().unwrap().len(), 2);
    assert_eq!(polled.load(Ordering::SeqCst), 2);
    drop(input);
    assert_eq!(polled.load(Ordering::SeqCst), 2);
  }

  #[test]
  fn validates_dates_limits_and_endpoint_without_disclosing_secrets() {
    assert!(validate_date("2026-02-30").is_err());
    assert!(validate_date("2026-10-15").is_ok());
    let mut settings = config();
    settings.url = "http://username:secret@localhost:8123".into();
    let error = ClickHouse::new(settings).err().unwrap().to_string();
    assert!(!error.contains("secret"));
    assert!(!error.contains("username"));
    let mut settings = config();
    settings.max_batch_bytes = settings.max_event_bytes - 1;
    assert!(ClickHouse::new(settings).is_err());
    assert_eq!(parse_u64(Some(&json!(u64::MAX))).unwrap(), u64::MAX);
    assert_eq!(
      parse_u64(Some(&json!(u64::MAX.to_string()))).unwrap(),
      u64::MAX
    );
    assert!(parse_u64(Some(&json!(-1))).is_err());
  }

  struct Request {
    path: String,
    headers: String,
    body: String,
    wire_bytes: usize,
  }

  struct ResponsePlan {
    status: u16,
    body: Vec<u8>,
    gzip: bool,
    observed: Option<oneshot::Sender<()>>,
    release: Option<oneshot::Receiver<()>>,
  }

  impl ResponsePlan {
    fn plain(status: u16, body: impl Into<String>) -> Self {
      Self {
        status,
        body: body.into().into_bytes(),
        gzip: false,
        observed: None,
        release: None,
      }
    }
  }

  async fn mock_http(
    responses: Vec<(u16, String)>,
  ) -> (String, tokio::task::JoinHandle<Vec<Request>>) {
    mock_http_planned(
      responses
        .into_iter()
        .map(|(status, body)| ResponsePlan::plain(status, body))
        .collect(),
    )
    .await
  }

  async fn mock_http_planned(
    responses: Vec<ResponsePlan>,
  ) -> (String, tokio::task::JoinHandle<Vec<Request>>) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let handle = tokio::spawn(async move {
      let mut requests = Vec::new();
      for response in responses {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = Vec::new();
        let header_end;
        loop {
          let mut chunk = [0u8; 4096];
          let read = socket.read(&mut chunk).await.unwrap();
          assert!(read > 0, "request ended before its headers");
          request.extend_from_slice(&chunk[..read]);
          if let Some(end) = request.windows(4).position(|window| window == b"\r\n\r\n") {
            header_end = end + 4;
            break;
          }
        }
        let headers = String::from_utf8(request[..header_end].to_vec()).unwrap();
        let length: usize = headers
          .lines()
          .find_map(|line| {
            line
              .to_ascii_lowercase()
              .strip_prefix("content-length:")
              .map(str::to_owned)
          })
          .unwrap()
          .trim()
          .parse()
          .unwrap();
        while request.len() < header_end + length {
          let mut chunk = [0u8; 4096];
          let read = socket.read(&mut chunk).await.unwrap();
          assert!(read > 0, "request ended before its body");
          request.extend_from_slice(&chunk[..read]);
        }
        let encoded_body = &request[header_end..header_end + length];
        let body = if headers
          .to_ascii_lowercase()
          .contains("content-encoding: gzip")
        {
          use std::io::Read;
          let mut decoder = flate2::read::GzDecoder::new(encoded_body);
          let mut body = String::new();
          decoder.read_to_string(&mut body).unwrap();
          body
        } else {
          String::from_utf8(encoded_body.to_vec()).unwrap()
        };
        requests.push(Request {
          path: headers
            .lines()
            .next()
            .unwrap()
            .split_whitespace()
            .nth(1)
            .unwrap()
            .to_owned(),
          headers,
          body,
          wire_bytes: length,
        });
        if let Some(observed) = response.observed {
          let _ = observed.send(());
        }
        if let Some(release) = response.release {
          let _ = release.await;
        }
        let encoding = if response.gzip {
          "Content-Encoding: gzip\r\n"
        } else {
          ""
        };
        let header = format!("HTTP/1.1 {} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\n{encoding}Connection: close\r\n\r\n", response.status, response.body.len());
        socket.write_all(header.as_bytes()).await.unwrap();
        socket.write_all(&response.body).await.unwrap();
        socket.shutdown().await.unwrap();
      }
      requests
    });
    (url, handle)
  }

  async fn requests(handle: tokio::task::JoinHandle<Vec<Request>>) -> Vec<Request> {
    tokio::time::timeout(Duration::from_secs(3), handle)
      .await
      .unwrap()
      .unwrap()
  }

  fn http_config(url: String) -> StorageConfig {
    let mut settings = config();
    settings.url = url;
    settings.max_event_bytes = 1024 * 1024;
    settings.max_batch_bytes = 2 * 1024 * 1024;
    settings
  }

  fn event(id: &str) -> Event {
    serde_json::from_value(json!({
        "$event_id": id,
        "$session_id": "session-a",
        "$service_time": "2026-10-15 00:00:00.123",
        "$uid": u64::MAX,
        "unknown_column": {"preserved": true},
    }))
    .unwrap()
  }

  fn attribution(key: &str, value: &str) -> Attribution {
    Attribution {
      event_id: json!("event-a"),
      session_id: json!("session-a"),
      attr_key: key.to_owned(),
      attr_value: value.to_owned(),
      event_time: json!("2026-10-15 00:00:00.123"),
    }
  }

  #[tokio::test]
  async fn http_source_is_parameterized_streamed_and_has_no_session_sort() {
    let first = serde_json::to_string(&event("event-a")).unwrap();
    let second = serde_json::to_string(&event("event-b")).unwrap();
    let (url, handle) = mock_http(vec![(200, format!("{first}\n{second}\n"))]).await;
    let storage = ClickHouse::new(http_config(url)).unwrap();
    let mut input = storage
      .read_slice("2026-10-15", "session'\\\nvalue")
      .await
      .unwrap();
    let batch = input.next_batch().await.unwrap().unwrap();
    assert_eq!(batch.len(), 2);
    assert_eq!(batch[0]["$uid"].as_u64(), Some(u64::MAX));
    assert!(input.next_batch().await.unwrap().is_none());
    let requests = requests(handle).await;
    assert!(requests[0].headers.contains("multipart/form-data"));
    assert!(!requests[0].path.contains("session"));
    assert!(requests[0].body.contains("name=\"param_sessionId\""));
    assert!(requests[0].body.contains("session'\\\nvalue"));
    assert!(requests[0].body.contains("{sessionId: String}"));
    assert!(!requests[0].body.contains("ORDER BY"));
  }

  #[tokio::test]
  async fn http_event_retry_only_inserts_missing_ids_and_preserves_wide_rows() {
    let (url, handle) = mock_http(vec![
      (200, "{\"$event_id\":\"event-0\"}\n".into()),
      (200, String::new()),
      (200, String::new()),
    ])
    .await;
    let storage = ClickHouse::new(http_config(url)).unwrap();
    let events = vec![event("event-0"), event("event-1"), event("event-'\\\n2")];
    assert_eq!(
      storage
        .write_events("2026-10-15", "session-a", &events)
        .await
        .unwrap(),
      2
    );
    let requests = requests(handle).await;
    assert!(requests[0]
      .body
      .contains("JSONExtract({eventIds: String}, 'Array(String)')"));
    assert!(requests[0].body.contains("[\"event-0\",\"event-1\"]"));
    assert!(requests[0].body.contains("{minTime: DateTime64(3)}"));
    assert!(requests[0].body.contains("name=\"param_maxTime\""));
    assert!(requests[1]
      .body
      .contains(&serde_json::to_string(&vec!["event-'\\\n2"]).unwrap()));
    let inserted: Vec<Event> = requests[2]
      .body
      .lines()
      .skip(1)
      .map(|line| serde_json::from_str(line).unwrap())
      .collect();
    assert_eq!(inserted, events[1..]);
    assert!(requests[2]
      .path
      .contains("date_time_input_format=best_effort"));
  }

  #[tokio::test]
  async fn http_repairs_partial_attributions_preserving_duplicate_row_multiplicity() {
    let existing = "{\"event_id\":\"event-a\",\"attr_key\":\"sameKey\",\"attr_value\":\"same\",\"rows\":\"1\"}\n";
    let (url, handle) = mock_http(vec![
      (200, existing.into()),
      (200, existing.into()),
      (200, String::new()),
    ])
    .await;
    let storage = ClickHouse::new(http_config(url)).unwrap();
    let rows = vec![
      attribution("sameKey", "same"),
      attribution("newKey", "new"),
      attribution("sameKey", "same"),
    ];
    assert_eq!(
      storage
        .write_attributions("2026-10-15", "session-a", &rows)
        .await
        .unwrap(),
      2
    );
    let requests = requests(handle).await;
    assert!(requests[0]
      .body
      .contains("Array(Tuple(String,String,String))"));
    assert!(requests[0]
      .body
      .contains("GROUP BY event_id, attr_key, attr_value"));
    let inserted: Vec<Value> = requests[2]
      .body
      .lines()
      .skip(1)
      .map(|line| serde_json::from_str(line).unwrap())
      .collect();
    assert_eq!(inserted.len(), 2);
    assert_eq!(inserted[0]["attr_key"], "newKey");
    assert_eq!(inserted[1]["attr_key"], "sameKey");
    assert_eq!(inserted[0]["event_time"], "2026-10-15 00:00:00.123");
  }

  #[tokio::test]
  async fn http_wide_attribution_value_uses_body_instead_of_an_oversized_url() {
    let (url, handle) = mock_http(vec![(200, String::new()), (200, String::new())]).await;
    let storage = ClickHouse::new(http_config(url)).unwrap();
    let rows = vec![attribution("wide", &"a".repeat(65536))];
    assert_eq!(
      storage
        .write_attributions("2026-10-15", "session-a", &rows)
        .await
        .unwrap(),
      1
    );
    let requests = requests(handle).await;
    assert!(requests[0].path.len() < 1024);
    assert!(requests[0].body.len() > 65536);
  }

  #[tokio::test]
  async fn http_insert_failure_is_detected_without_exposing_response_contents() {
    let (url, handle) = mock_http(vec![
      (200, String::new()),
      (
        200,
        "Code: 123. secret source event and database credential".into(),
      ),
    ])
    .await;
    let storage = ClickHouse::new(http_config(url)).unwrap();
    let error = storage
      .write_events("2026-10-15", "session-a", &[event("event-a")])
      .await
      .unwrap_err();
    assert_eq!(
      error.to_string(),
      "ClickHouse insert returned an unexpected response body"
    );
    assert!(!error.to_string().contains("secret"));
    requests(handle).await;

    let (url, handle) = mock_http(vec![(503, "secret ClickHouse internals".into())]).await;
    let storage = ClickHouse::new(http_config(url)).unwrap();
    let error = storage.check().await.unwrap_err().to_string();
    assert_eq!(error, "ClickHouse returned HTTP 503");
    requests(handle).await;
  }

  #[tokio::test]
  async fn http_count_retains_full_u64_precision() {
    let (url, handle) = mock_http(vec![(200, format!("{{\"count\":{}}}\n", u64::MAX))]).await;
    let storage = ClickHouse::new(http_config(url)).unwrap();
    assert_eq!(
      storage
        .count_slice("2026-10-15", "session-a")
        .await
        .unwrap(),
      u64::MAX
    );
    requests(handle).await;
  }

  #[test]
  fn parameter_batches_are_bounded_without_dropping_large_or_duplicate_values() {
    let rows = ["a".to_owned(), "a".to_owned(), "b".repeat(100)];
    let batches = parameter_batches(rows.iter(), 2, 128).unwrap();
    assert_eq!(batches.len(), 2);
    assert_eq!(
      serde_json::from_str::<Vec<String>>(&batches[0]).unwrap(),
      rows[..2]
    );
    assert_eq!(
      serde_json::from_str::<Vec<String>>(&batches[1]).unwrap(),
      rows[2..]
    );
    assert!(batches.iter().all(|batch| batch.len() <= 128));
  }

  #[test]
  fn batch_time_bounds_only_compare_canonical_datetime64_strings() {
    let mut first = event("first");
    let mut last = event("last");
    first.insert("$service_time".into(), json!("2026-10-15 01:00:00.123"));
    last.insert("$service_time".into(), json!("2026-10-15 23:00:00.999"));
    let events = [last.clone(), first];
    assert_eq!(
      event_time_bounds(&events),
      Some(("2026-10-15 01:00:00.123", "2026-10-15 23:00:00.999"))
    );
    last.insert("$service_time".into(), json!("2026-10-15T23:00:00.999Z"));
    assert!(event_time_bounds(&[last]).is_none());
    assert!(event_time_bounds(&[]).is_none());
  }

  #[tokio::test]
  async fn gzip_response_and_insert_round_trip_preserve_rows_and_reduce_wire_size() {
    let mut events = vec![event("compressed-a"), event("compressed-b")];
    // Also exercise the blocking-pool compression path for larger wide rows.
    events[0].insert("large_column".into(), json!("repeat".repeat(16384)));
    let input = events
      .iter()
      .map(|row| serde_json::to_string(row).unwrap())
      .collect::<Vec<_>>()
      .join("\n");
    let mut response = ResponsePlan::plain(200, "");
    response.gzip = true;
    response.body = gzip_body(input).unwrap();
    let (url, handle) = mock_http_planned(vec![response, ResponsePlan::plain(200, "")]).await;
    let mut settings = http_config(url);
    settings.compression = true;
    let storage = ClickHouse::new(settings).unwrap();
    let mut stream = storage.read_slice("2026-10-15", "session-a").await.unwrap();
    assert_eq!(stream.next_batch().await.unwrap().unwrap(), events);
    assert!(stream.next_batch().await.unwrap().is_none());
    assert_eq!(
      storage
        .insert_rows("final_event_log", events.iter())
        .await
        .unwrap(),
      2
    );
    let requests = requests(handle).await;
    assert!(requests[0]
      .headers
      .to_ascii_lowercase()
      .contains("accept-encoding: gzip"));
    assert!(requests[0].path.contains("enable_http_compression=1"));
    assert!(requests[1]
      .headers
      .to_ascii_lowercase()
      .contains("content-encoding: gzip"));
    assert!(requests[1].wire_bytes < requests[1].body.len());
    let actual: Vec<Event> = requests[1]
      .body
      .lines()
      .skip(1)
      .map(|line| serde_json::from_str(line).unwrap())
      .collect();
    assert_eq!(actual, events);
    assert_eq!(actual[0]["$uid"].as_u64(), Some(u64::MAX));
  }

  #[tokio::test]
  async fn compression_can_be_disabled_for_requests_and_responses() {
    let (url, handle) = mock_http(vec![(200, String::new())]).await;
    let storage = ClickHouse::new(http_config(url)).unwrap();
    storage
      .insert_rows("final_event_log", [event("plain")].iter())
      .await
      .unwrap();
    let requests = requests(handle).await;
    let headers = requests[0].headers.to_ascii_lowercase();
    assert!(!headers.contains("content-encoding: gzip"));
    assert!(!headers.contains("accept-encoding: gzip"));
    assert!(!requests[0].path.contains("enable_http_compression"));
  }

  #[tokio::test]
  async fn concurrent_sessions_are_deduplicated_separately_then_share_one_insert() {
    let (url, handle) = mock_http(vec![
      (200, String::new()),
      (200, String::new()),
      (200, String::new()),
    ])
    .await;
    let mut settings = http_config(url);
    settings.batch_size = 4;
    settings.write_batch_wait_ms = 100;
    let storage = ClickHouse::new(settings).unwrap();
    let first = [event("event-a")];
    let mut second_row = event("event-b");
    second_row.insert("$session_id".into(), json!("session-b"));
    let second = [second_row];
    let (left, right) = tokio::join!(
      storage.write_events("2026-10-15", "session-a", &first),
      storage.write_events("2026-10-15", "session-b", &second),
    );
    assert_eq!(left.unwrap(), 1);
    assert_eq!(right.unwrap(), 1);
    let requests = requests(handle).await;
    assert_eq!(requests.len(), 3);
    assert!(requests[0].body.contains("{sessionId: String}"));
    assert!(requests[1].body.contains("{sessionId: String}"));
    assert_ne!(
      requests[0].body.contains("\r\nsession-a\r\n"),
      requests[1].body.contains("\r\nsession-a\r\n")
    );
    let inserted: Vec<Value> = requests[2]
      .body
      .lines()
      .skip(1)
      .map(|line| serde_json::from_str(line).unwrap())
      .collect();
    let sessions: HashSet<_> = inserted
      .iter()
      .map(|row| row["$session_id"].as_str().unwrap())
      .collect();
    assert_eq!(sessions, HashSet::from(["session-a", "session-b"]));
  }

  async fn gated_batch_result(status: u16) {
    let (observed, received) = oneshot::channel();
    let (release, released) = oneshot::channel();
    let mut response = ResponsePlan::plain(status, "");
    response.observed = Some(observed);
    response.release = Some(released);
    let (url, handle) = mock_http_planned(vec![response]).await;
    let mut settings = http_config(url);
    settings.batch_size = 2;
    settings.write_batch_wait_ms = 100;
    let storage = ClickHouse::new(settings).unwrap();
    let left_storage = storage.clone();
    let right_storage = storage.clone();
    let left = tokio::spawn(async move {
      left_storage
        .insert_rows("final_event_log", [event("left")].iter())
        .await
    });
    let right = tokio::spawn(async move {
      right_storage
        .insert_rows("final_event_log", [event("right")].iter())
        .await
    });
    tokio::time::timeout(Duration::from_secs(3), received)
      .await
      .unwrap()
      .unwrap();
    assert!(
      !left.is_finished(),
      "caller cannot complete before durable HTTP acknowledgement"
    );
    assert!(
      !right.is_finished(),
      "every caller in a shared insert waits for acknowledgement"
    );
    release.send(()).unwrap();
    let left = left.await.unwrap();
    let right = right.await.unwrap();
    if status == 200 {
      assert_eq!(left.unwrap(), 1);
      assert_eq!(right.unwrap(), 1);
    } else {
      assert!(left.is_err());
      assert!(right.is_err());
    }
    let requests = requests(handle).await;
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].body.lines().skip(1).count(), 2);
  }

  #[tokio::test]
  async fn shared_insert_acknowledges_all_callers_only_after_http_success() {
    gated_batch_result(200).await;
  }

  #[tokio::test]
  async fn shared_insert_failure_is_propagated_to_every_contributing_caller() {
    gated_batch_result(503).await;
  }

  #[tokio::test]
  async fn aggregation_obeys_row_limit_and_failed_writer_can_process_later_work() {
    let (url, handle) = mock_http(vec![(503, String::new()), (200, String::new())]).await;
    let mut settings = http_config(url);
    settings.batch_size = 2;
    settings.write_batch_wait_ms = 100;
    let storage = ClickHouse::new(settings).unwrap();
    let failed_a = [event("failed-a")];
    let failed_b = [event("failed-b")];
    let (left, right) = tokio::join!(
      storage.insert_rows("final_event_log", failed_a.iter()),
      storage.insert_rows("final_event_log", failed_b.iter()),
    );
    assert!(left.is_err());
    assert!(right.is_err());
    assert_eq!(
      storage
        .insert_rows("final_event_log", [event("later")].iter())
        .await
        .unwrap(),
      1
    );
    let requests = requests(handle).await;
    assert_eq!(requests[0].body.lines().skip(1).count(), 2);
    assert_eq!(requests[1].body.lines().skip(1).count(), 1);
  }

  #[tokio::test]
  async fn aggregation_obeys_byte_limit_even_below_row_limit() {
    let events = [event("a"), event("b"), event("c")];
    let row_bytes = serde_json::to_string(&events[0]).unwrap().len() + 1;
    let (url, handle) = mock_http(vec![(200, String::new()), (200, String::new())]).await;
    let mut settings = http_config(url);
    settings.batch_size = 100;
    settings.max_event_bytes = row_bytes;
    settings.max_batch_bytes = row_bytes * 2;
    settings.write_batch_wait_ms = 100;
    let limit = settings.max_batch_bytes;
    let storage = ClickHouse::new(settings).unwrap();
    let (a, b, c) = tokio::join!(
      storage.insert_rows("final_event_log", events[..1].iter()),
      storage.insert_rows("final_event_log", events[1..2].iter()),
      storage.insert_rows("final_event_log", events[2..].iter()),
    );
    assert_eq!((a.unwrap(), b.unwrap(), c.unwrap()), (1, 1, 1));
    let requests = requests(handle).await;
    assert_eq!(requests.len(), 2);
    let mut total = 0;
    for request in requests {
      let payload = request.body.split_once('\n').unwrap().1;
      assert!(payload.len() <= limit);
      total += payload.lines().count();
    }
    assert_eq!(total, 3);
  }

  #[tokio::test]
  async fn large_call_is_split_and_shared_queue_applies_backpressure() {
    let (observed, received) = oneshot::channel();
    let (release, released) = oneshot::channel();
    let mut first = ResponsePlan::plain(200, "");
    first.observed = Some(observed);
    first.release = Some(released);
    let (url, handle) = mock_http_planned(vec![
      first,
      ResponsePlan::plain(200, ""),
      ResponsePlan::plain(200, ""),
      ResponsePlan::plain(200, ""),
    ])
    .await;
    let mut settings = http_config(url);
    settings.batch_size = 2;
    let storage = ClickHouse::new(settings).unwrap();
    let writer = storage.clone();
    let task = tokio::spawn(async move {
      let rows: Vec<_> = (0..7)
        .map(|index| event(&format!("event-{index}")))
        .collect();
      writer.insert_rows("final_event_log", rows.iter()).await
    });
    tokio::time::timeout(Duration::from_secs(3), received)
      .await
      .unwrap()
      .unwrap();
    assert!(!task.is_finished());
    assert_eq!(storage.inserts.events.get().unwrap().max_capacity(), 2);
    assert_eq!(
      storage.inserts.events.get().unwrap().capacity(),
      2,
      "one caller waits for its first acknowledgement before queuing further chunks"
    );
    release.send(()).unwrap();
    assert_eq!(task.await.unwrap().unwrap(), 7);
    let requests = requests(handle).await;
    let counts: Vec<_> = requests
      .iter()
      .map(|request| request.body.lines().skip(1).count())
      .collect();
    assert_eq!(counts, [2, 2, 2, 1]);
  }
}
