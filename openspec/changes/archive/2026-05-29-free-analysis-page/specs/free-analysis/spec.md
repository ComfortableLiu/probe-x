## ADDED Requirements

### Requirement: FreeAnalysis page SHALL display a three-column layout
The FreeAnalysis page SHALL render a three-column layout: left panel for event/metric selection, center area for query condition configuration, and right area for result display (chart + data table).

#### Scenario: Page renders with three columns on load
- **WHEN** user navigates to `/data-analysis/free`
- **THEN** the page SHALL display a left selection panel, a center query configuration area, and a right result display area

### Requirement: Left panel SHALL allow selecting multiple events and metrics
The left panel SHALL allow users to add, remove, and configure multiple events. Each event SHALL support selecting a metrics type (COUNT, USERS, SESSIONS) and per-event filters.

#### Scenario: User adds multiple events
- **WHEN** user clicks the "添加指标" button in the left panel
- **THEN** a new event selector row SHALL appear, allowing the user to choose an event name and metrics type

#### Scenario: User removes an event
- **WHEN** user clicks the remove button on an event row
- **THEN** that event SHALL be removed from the selection list

### Requirement: Center area SHALL support query condition configuration
The center area SHALL provide controls for time range selection, global filter conditions, and dimension (group-by) selection.

#### Scenario: User configures time range
- **WHEN** user selects a start date and end date in the time range selector
- **THEN** the time range SHALL be reflected in the query parameters

#### Scenario: User adds global filters
- **WHEN** user adds a global filter with property name, compare type, and value
- **THEN** the filter SHALL be included in the query parameters

#### Scenario: User selects dimensions
- **WHEN** user selects one or more dimension properties
- **THEN** the selected dimensions SHALL be included as group-by fields in the query

### Requirement: FreeAnalysis SHALL submit query via POST API
The page SHALL submit the assembled query parameters to `POST /api/data-analysis/free/query` and store the results in the Rematch model.

#### Scenario: Successful query execution
- **WHEN** user clicks the "查询" button with valid parameters (at least one event, time range, and dimension)
- **THEN** the page SHALL send a POST request to `/api/data-analysis/free/query` and display the results

#### Scenario: Query validation failure
- **WHEN** user clicks "查询" without selecting any event or time range
- **THEN** an error message SHALL be displayed indicating the missing required fields

### Requirement: Right area SHALL display ECharts multi-dimension chart
The right result area SHALL render an ECharts chart supporting line and bar chart type toggle. The chart SHALL display one series per event, aggregated across all dimension rows.

#### Scenario: Chart renders with query results
- **WHEN** query returns data with multiple events over a date range
- **THEN** the chart SHALL display one series per event with date on X-axis and metric values on Y-axis

#### Scenario: Chart type toggle
- **WHEN** user clicks the line/bar toggle in the chart toolbox
- **THEN** the chart SHALL switch between line and bar visualization

### Requirement: Right area SHALL display data detail table
Below the chart, a data table SHALL display the query results with dimension columns, event name column, and date columns showing metric values. Dimension columns with identical values SHALL be merged (rowSpan).

#### Scenario: Table renders with merged dimension cells
- **WHEN** query returns data grouped by dimensions
- **THEN** the table SHALL display dimension columns with merged cells for identical consecutive values

### Requirement: FreeAnalysis SHALL support saving query as dashboard card
The page SHALL provide a "保存为看板" button that opens the SaveAsDashboardPopup with `AnalysisType.FREE`, allowing users to save the current query configuration as a dashboard card.

#### Scenario: Save as dashboard card
- **WHEN** user clicks "保存为看板" and enters a dashboard name
- **THEN** the system SHALL create a new dashboard card with the current free analysis query configuration

### Requirement: Free analysis route SHALL be visible in navigation menu
The free analysis route SHALL NOT have `isHidden: true` in its meta configuration, making it visible in the data analysis navigation menu.

#### Scenario: Menu visibility
- **WHEN** user navigates to the data analysis section
- **THEN** the "自由分析" menu item SHALL be visible in the navigation

### Requirement: Backend free/query endpoint SHALL reuse EventAnalysisSqlBuilder
The `POST /api/data-analysis/free/query` endpoint SHALL accept `IFreeAnalysisReq` parameters and use `generateEventAnalysisSql()` to build the ClickHouse query.

#### Scenario: API processes free analysis query
- **WHEN** the backend receives a valid `IFreeAnalysisReq` with events, time range, dimensions, and optional filters
- **THEN** it SHALL generate SQL via `generateEventAnalysisSql()`, execute against ClickHouse, and return `IFreeAnalysisRes`

#### Scenario: API handles invalid query
- **WHEN** the backend receives a request with empty event list or invalid time range
- **THEN** it SHALL return a business error with a descriptive message
