import React, { memo } from "react"
import { Select } from "antd"
import { useQuery, useRouter } from "@/hooks"
import { IQuery, METRIC_OPTIONS } from "@pages/data-analysis/utm/type"

/**
 * 数据指标多选
 * 第一个选中的指标决定表格排序与趋势图的纵轴
 */
function UtmMetricSelector() {

  const {
    metrics = [],
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  return (
    <Select
      mode="multiple"
      allowClear
      style={{ minWidth: 360 }}
      placeholder="选择数据指标，可多选"
      value={metrics}
      onChange={(value) => refresh({ metrics: value }, true)}
      options={METRIC_OPTIONS}
    />
  )
}

export default memo(UtmMetricSelector)
