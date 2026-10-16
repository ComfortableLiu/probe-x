import React, { memo, useCallback } from "react"
import { Radio } from "antd"
import { useQuery, useRouter } from "@/hooks"
import { RetentionGranularity } from "@probe-x/shared-types/src"
import { IQuery } from "@pages/data-analysis/retention/type"

function Granularity() {

  const {
    granularity,
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  const handleChange = useCallback((value: RetentionGranularity) => {
    refresh({
      granularity: value,
    }, true)
  }, [refresh])

  return (
    <Radio.Group
      buttonStyle="solid"
      value={granularity}
      onChange={(e) => handleChange(e.target.value)}
      options={[{
        label: '按日',
        value: RetentionGranularity.DAY,
      }, {
        label: '按周',
        value: RetentionGranularity.WEEK,
      }, {
        label: '按月',
        value: RetentionGranularity.MONTH,
      }]}
    />
  )
}

export default memo(Granularity)
