## ADDED Requirements

### Requirement: ContributionPieChart SHALL display contribution distribution as a pie chart
The `ContributionPieChart` component SHALL render an ECharts pie chart showing the contribution percentage of each attribution event. Data SHALL be read from the Redux store (`dataAnalysisAttributionModel.data`). Rows with the same `attributionEventName` SHALL be aggregated by summing their `contribution.rate`.

#### Scenario: Pie chart renders with attribution data
- **WHEN** user submits an attribution query and data is available in the store
- **THEN** the pie chart SHALL display one slice per unique attribution event, with the slice size proportional to the aggregated contribution rate

#### Scenario: Pie chart shows empty state when no data
- **WHEN** no query has been submitted or the query returned empty data
- **THEN** the component SHALL display an Ant Design `Empty` placeholder

#### Scenario: Pie chart tooltip shows detailed info
- **WHEN** user hovers over a pie slice
- **THEN** the tooltip SHALL show the event name, contribution percentage, and aggregated conversion metric

### Requirement: ModelComparisonBar SHALL compare contribution across attribution models
The `ModelComparisonBar` component SHALL render an ECharts grouped bar chart comparing touchpoint contributions across all 5 attribution models (`FIRST_TOUCH`, `LAST_TOUCH`, `LINEAR`, `POSITION`, `TIME_DECAY`). A new Redux effect `queryAllModels` SHALL query all models in parallel using the same filter parameters.

#### Scenario: Bar chart renders with multi-model data
- **WHEN** user clicks "模型对比" button and all 5 model queries complete
- **THEN** the bar chart SHALL display grouped bars with X-axis as attribution event names and one bar group per model, Y-axis as contribution percentage

#### Scenario: Bar chart shows loading state during query
- **WHEN** the `queryAllModels` effect is in progress
- **THEN** the component SHALL display an ECharts loading animation

#### Scenario: Bar chart shows legend for all 5 models
- **WHEN** the chart is rendered
- **THEN** the legend SHALL display all 5 model names in Chinese (首次触点、末次触点、线性、位置、时间衰减)

### Requirement: AttributionFunnelChart SHALL display conversion funnel
The `AttributionFunnelChart` component SHALL render an ECharts funnel chart showing the conversion funnel from touchpoint events to conversion. Data SHALL be aggregated by `attributionEventName` from the Redux store.

#### Scenario: Funnel chart renders with attribution data
- **WHEN** user submits an attribution query and data is available
- **THEN** the funnel chart SHALL display one funnel step per unique attribution event, sorted by aggregated conversion metric descending, with the largest at the top

#### Scenario: Funnel chart shows empty state when no data
- **WHEN** no data is available
- **THEN** the component SHALL display an Ant Design `Empty` placeholder

#### Scenario: Funnel chart tooltip shows detailed info
- **WHEN** user hovers over a funnel step
- **THEN** the tooltip SHALL show the event name, aggregated conversion metric, and aggregated conversion rate

### Requirement: Redux state SHALL support model comparison data
The `dataAnalysisAttributionModel` SHALL include a `modelComparisonData` field storing an array of `{ model: AttributionModelEnum, data: IAttributionAnalysisRes }`. A `queryAllModels` effect SHALL be added to query all 5 models in parallel.

#### Scenario: queryAllModels queries all 5 models
- **WHEN** `queryAllModels` is dispatched
- **THEN** it SHALL call `submitQueryTask` 5 times in parallel with `attributionModel` set to each `AttributionModelEnum` value, and store results in `modelComparisonData`

#### Scenario: modelComparisonData is cleared on new single-model query
- **WHEN** `submitQuery` is dispatched (single model query)
- **THEN** `modelComparisonData` SHALL be cleared (set to undefined)

### Requirement: Charts SHALL be integrated into the attribution analysis page
The three chart components SHALL be rendered in `attribution/index.tsx` between `DataFilterConfigArea` and `DataTable`. A "模型对比" button SHALL trigger the `queryAllModels` effect.

#### Scenario: Charts visible on page with data
- **WHEN** user navigates to attribution page and submits a valid query
- **THEN** the pie chart and funnel chart SHALL be visible in a side-by-side layout, followed by the model comparison bar chart section with a trigger button

#### Scenario: Model comparison triggered by button click
- **WHEN** user clicks "模型对比" button
- **THEN** the `queryAllModels` effect SHALL be dispatched and the bar chart SHALL render with loading state, then display results

### Requirement: Charts SHALL resize responsively
All chart components SHALL handle window resize events to maintain proper dimensions.

#### Scenario: Window resize
- **WHEN** the browser window is resized
- **THEN** all visible charts SHALL resize to fit their container widths without overflow
