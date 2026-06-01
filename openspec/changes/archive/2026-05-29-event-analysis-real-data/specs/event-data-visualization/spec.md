## ADDED Requirements

### Requirement: DataChart SHALL display real API data instead of mock data
The DataChart component SHALL read query results from the Redux store (`dataAnalysisEventModel.data`) and render an ECharts line chart with the real data. The component SHALL NOT contain any hardcoded mock data.

#### Scenario: Chart renders with API data after query
- **WHEN** user submits a query with events, time range, and dimensions
- **THEN** DataChart SHALL display a line chart with X-axis as dates from the query time range and Y-axis as metric values from the API response

#### Scenario: Chart shows empty state when no data
- **WHEN** no query has been submitted or the query returned empty data
- **THEN** DataChart SHALL display an empty state message instead of a blank chart

### Requirement: DataChart SHALL support multi-event comparison
The chart SHALL render one line series per event defined in `eventInfoList`. Each series SHALL be labeled with the event name. The legend SHALL allow toggling individual events.

#### Scenario: Multiple events displayed as separate lines
- **WHEN** user queries with 3 events (e.g., page_view, page_leave, click) over a 7-day range
- **THEN** the chart SHALL display 3 separate lines, each with a distinct color, and the legend SHALL show all 3 event names

#### Scenario: Single event displayed correctly
- **WHEN** user queries with 1 event
- **THEN** the chart SHALL display a single line with the event name in the legend

### Requirement: DataChart SHALL dynamically adapt to API response field structure
The chart data transformation SHALL parse the `GenericEventAnalysisResult[]` structure dynamically, extracting event-date metric fields (pattern: `event_{index}_{eventName}_{YYYY}_{MM}_{DD}`) without hardcoding field names.

#### Scenario: Dynamic field extraction
- **WHEN** API returns rows with fields like `event_0_page_view_2025_11_05`, `event_1_click_2025_11_05`
- **THEN** the chart SHALL correctly map these fields to their respective event series and date categories

### Requirement: DataChart SHALL be enabled in the event analysis page
The `<DataChart />` component SHALL be rendered in the main event analysis page (`index.tsx`) between the filter area and the data table, separated by a horizontal rule.

#### Scenario: Chart visible on page load after query
- **WHEN** user navigates to the event analysis page and submits a valid query
- **THEN** the chart section SHALL be visible between the filter config area and the data table

### Requirement: DataChart SHALL resize responsively
The chart SHALL handle window resize events to maintain proper dimensions.

#### Scenario: Window resize
- **WHEN** the browser window is resized
- **THEN** the chart SHALL resize to fit its container width without overflow