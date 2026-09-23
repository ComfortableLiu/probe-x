import React, { memo } from "react"
import { Select } from "antd"
import { useQuery, useRouter } from "@/hooks"
import {
  UTM_DIMENSIONS,
  UTM_DIMENSION_OPTION_LABEL,
} from "@probe-x/shared-types/src"
import { IQuery } from "@pages/data-analysis/utm/type"

/**
 * UTM 分组维度多选
 * 选几个维度就按几个维度的组合做交叉分析
 */
function UtmDimensionSelector() {

  const {
    dimensions = [],
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  return (
    <Select
      mode="multiple"
      allowClear
      style={{ minWidth: 360 }}
      placeholder="选择 UTM 维度，可多选做交叉分析"
      value={dimensions}
      onChange={(value) => refresh({ dimensions: value }, true)}
      options={UTM_DIMENSIONS.map((dimension) => ({
        label: UTM_DIMENSION_OPTION_LABEL[dimension],
        value: dimension,
      }))}
    />
  )
}

export default memo(UtmDimensionSelector)
