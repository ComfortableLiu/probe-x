import React, { memo } from "react"
import { useQuery, useRouter } from "@/hooks"
import { IQuery } from "@pages/data-analysis/event/type"
import dayjs from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat"
import { DatePicker } from "antd"

dayjs.extend(customParseFormat)

const { RangePicker } = DatePicker

function TimeRangeSelector() {

  const {
    timeRange = [],
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  // 修改时间范围
  const changeTimeRange = (value: [string, string]) => {
    refresh({
      timeRange: value,
    }, true)
  }

  return (
    <RangePicker
      allowClear={false}
      disabledDate={current => current && current > dayjs().endOf('day')}
      value={[dayjs(timeRange[0], 'YYYY-MM-DD'), dayjs(timeRange[1], 'YYYY-MM-DD')]}
      onChange={(_, value) => changeTimeRange(value)}
    />
  )
}

export default memo(TimeRangeSelector)
