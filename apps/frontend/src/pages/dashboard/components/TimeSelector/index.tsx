import React, { useMemo } from "react"
import { DatePicker } from "antd"
import dayjs, { Dayjs } from "dayjs"
import { ITimeSelection, RELATIVE_TIME_PRESETS, resolveTimeRange } from "../../time"

interface ITimeSelectorProps {
  value: ITimeSelection
  onChange: (value: ITimeSelection) => void
}

/**
 * 时间选择器：RangePicker + 相对时间快捷预设
 * 选中预设时按相对时间保存（查询时动态解析），手动选择日期则按绝对时间保存
 */
function TimeSelector(props: ITimeSelectorProps) {
  const { value, onChange } = props

  const pickerValue = useMemo<[Dayjs, Dayjs]>(() => {
    const [start, end] = resolveTimeRange(value)
    return [dayjs(start), dayjs(end)]
  }, [value])

  // 预设值每次渲染时重新计算，避免跨天后「今天」等预设过期
  const presets = RELATIVE_TIME_PRESETS.map(preset => ({
    label: preset.label,
    value: preset.getRange(),
  }))

  const handleChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (!dates?.[0] || !dates?.[1]) return
    const range: [string, string] = [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]
    // 与预设完全匹配时按相对时间处理，保证轮询时动态解析
    const matched = RELATIVE_TIME_PRESETS.find((preset) => {
      const [start, end] = preset.getRange()
      return start.format('YYYY-MM-DD') === range[0] && end.format('YYYY-MM-DD') === range[1]
    })
    onChange(matched ? { type: 'relative', key: matched.key } : { type: 'absolute', range })
  }

  return (
    <DatePicker.RangePicker
      value={pickerValue}
      presets={presets}
      onChange={handleChange}
      allowClear={false}
      size="small"
    />
  )
}

export default TimeSelector
