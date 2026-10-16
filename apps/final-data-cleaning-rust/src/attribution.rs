//! The Node attribution algorithm, operating on complete ClickHouse rows.
//!
//! A row is moved through the pipeline instead of projected into a fixed schema:
//! new event columns and UInt64 values therefore survive without a conversion.

use std::borrow::Cow;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

pub type Event = Map<String, Value>;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Attribution {
  pub event_id: Value,
  pub session_id: Value,
  pub attr_key: String,
  pub attr_value: String,
  pub event_time: Value,
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttributionResult {
  pub final_events: Vec<Event>,
  pub attributions: Vec<Attribution>,
}

/// Calculate an already bounded batch and transfer the input rows unchanged.
pub fn compute_attribution(events: Vec<Event>) -> AttributionResult {
  let mut attributions = Vec::new();
  for event in &events {
    visit_attributions(event, |row| attributions.push(row));
  }
  AttributionResult {
    final_events: events,
    attributions,
  }
}

pub fn attribute_event(event: &Event) -> Vec<Attribution> {
  let mut rows = Vec::new();
  visit_attributions(event, |row| rows.push(row));
  rows
}

/// Visit one row at a time without allocating a second Vec of expanded values.
/// This supports a bounded writer even if an event has many extension fields.
pub fn visit_attributions(event: &Event, mut visitor: impl FnMut(Attribution)) {
  if !is_js_truthy(event.get("$is_attribution_event"))
    || !is_js_truthy(event.get("$target_page_id"))
  {
    return;
  }
  let Some(params) = parse_params(event.get("$ex_attribution_params")) else {
    return;
  };
  let event_id = event.get("$event_id").cloned().unwrap_or(Value::Null);
  let session_id = event.get("$session_id").cloned().unwrap_or(Value::Null);
  let event_time = event.get("$service_time").cloned().unwrap_or(Value::Null);
  let mut emit = |key: &str, value: &Value| {
    visitor(Attribution {
      event_id: event_id.clone(),
      session_id: session_id.clone(),
      attr_key: underline_to_camel(key),
      attr_value: js_string(value),
      event_time: event_time.clone(),
    });
  };

  // JS Object.entries enumerates array-index keys numerically, then other
  // string keys in insertion order. 2^32-1 and leading-zero keys are strings.
  let mut index_keys: Vec<_> = params
    .iter()
    .filter_map(|(key, value)| array_index(key).map(|index| (index, key, value)))
    .collect();
  index_keys.sort_unstable_by_key(|(index, _, _)| *index);
  for (_, key, value) in index_keys {
    emit(key, value);
  }
  for (key, value) in params.iter() {
    if array_index(key).is_none() {
      emit(key, value);
    }
  }
}

fn parse_params(raw: Option<&Value>) -> Option<Cow<'_, Map<String, Value>>> {
  match raw? {
    Value::Object(object) => Some(Cow::Borrowed(object)),
    Value::String(text) => match serde_json::from_str::<Value>(text).ok()? {
      Value::Object(object) => Some(Cow::Owned(object)),
      _ => None,
    },
    _ => None,
  }
}

fn is_js_truthy(value: Option<&Value>) -> bool {
  match value {
    None | Some(Value::Null) => false,
    Some(Value::Bool(value)) => *value,
    Some(Value::Number(value)) => number_as_js(value) != 0.0,
    Some(Value::String(value)) => !value.is_empty(),
    Some(Value::Array(_) | Value::Object(_)) => true,
  }
}

fn array_index(key: &str) -> Option<u32> {
  if key.is_empty() || (key.len() > 1 && key.starts_with('0')) {
    return None;
  }
  if !key.bytes().all(|byte| byte.is_ascii_digit()) {
    return None;
  }
  key.parse::<u32>().ok().filter(|index| *index != u32::MAX)
}

fn underline_to_camel(key: &str) -> String {
  let mut result = String::with_capacity(key.len());
  let mut characters = key.chars().peekable();
  while let Some(character) = characters.next() {
    if character == '_' {
      if let Some(next) = characters.peek().copied().filter(char::is_ascii_lowercase) {
        result.push(next.to_ascii_uppercase());
        characters.next();
        continue;
      }
    }
    result.push(character);
  }
  result
}

fn number_as_js(value: &serde_json::Number) -> f64 {
  // JavaScript JSON.parse uses IEEE754 numbers. Keep this conversion limited
  // to dynamic attribute values; the original event remains lossless JSON.
  value
    .as_f64()
    .unwrap_or_else(|| value.to_string().parse().unwrap_or(f64::NAN))
}

fn js_string(value: &Value) -> String {
  match value {
    Value::Null => "null".to_owned(),
    Value::Bool(value) => value.to_string(),
    Value::Number(value) => {
      let value = number_as_js(value);
      if value == 0.0 {
        "0".to_owned()
      } else {
        ryu_js::Buffer::new().format(value).to_owned()
      }
    }
    Value::String(value) => value.clone(),
    Value::Object(_) => "[object Object]".to_owned(),
    Value::Array(values) => {
      let mut result = String::new();
      for (index, item) in values.iter().enumerate() {
        if index > 0 {
          result.push(',');
        }
        // Array#join renders null/undefined as an empty element.
        if !item.is_null() {
          result.push_str(&js_string(item));
        }
      }
      result
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  fn base_event(params: Value) -> Event {
    json!({
        "$event_id": "event-1",
        "$session_id": "session-1",
        "$service_time": "2026-10-15 12:00:00.123",
        "$is_attribution_event": true,
        "$target_page_id": "target-page",
        "$ex_attribution_params": params,
    })
    .as_object()
    .unwrap()
    .clone()
  }

  #[test]
  fn matches_original_node_engine_golden_cases() {
    #[derive(Deserialize)]
    struct Case {
      name: String,
      input: Vec<Event>,
      expected: AttributionResult,
    }
    let cases: Vec<Case> = serde_json::from_str(include_str!(
      "../tests/fixtures/node-attribution-golden.json"
    ))
    .unwrap();
    for case in cases {
      assert_eq!(
        compute_attribution(case.input),
        case.expected,
        "{}",
        case.name
      );
    }
  }

  #[test]
  fn preserves_full_rows_and_uint64_without_floating_point_conversion() {
    let raw = r#"{"$event_id":"event-1","$session_id":"session-1","$service_time":"2026-10-15 12:00:00.999","$is_attribution_event":true,"$target_page_id":"target","$ex_attribution_params":{"x":1},"custom_uint64":18446744073709551615,"custom":{"future_field":[1,null,"中文"]}}"#;
    let original: Event = serde_json::from_str(raw).unwrap();
    let result = compute_attribution(vec![original.clone()]);
    assert_eq!(result.final_events, vec![original]);
    assert_eq!(
      result.final_events[0]["custom_uint64"].as_u64(),
      Some(u64::MAX)
    );
    assert!(serde_json::to_string(&result.final_events[0])
      .unwrap()
      .contains("18446744073709551615"));
    assert_eq!(result.attributions[0].event_time, "2026-10-15 12:00:00.999");
  }

  #[test]
  fn enumerates_integer_keys_before_insertion_order_keys() {
    let mut params = Map::new();
    for key in ["last_key", "10", "2", "01", "4294967294", "4294967295", "0"] {
      params.insert(key.to_owned(), Value::String(key.to_owned()));
    }
    let rows = attribute_event(&base_event(Value::Object(params)));
    assert_eq!(
      rows
        .iter()
        .map(|row| row.attr_key.as_str())
        .collect::<Vec<_>>(),
      ["0", "2", "10", "4294967294", "lastKey", "01", "4294967295"]
    );
  }

  #[test]
  fn handles_many_properties_without_argument_spread_or_stack_growth() {
    let mut params = Map::new();
    for index in 0..200_000 {
      params.insert(format!("$attribute_{index}"), Value::from(index));
    }
    let mut count = 0;
    visit_attributions(&base_event(Value::Object(params)), |row| {
      assert_eq!(row.attr_key, format!("$attribute_{count}"));
      assert_eq!(row.attr_value, count.to_string());
      count += 1;
    });
    assert_eq!(count, 200_000);
  }
}
