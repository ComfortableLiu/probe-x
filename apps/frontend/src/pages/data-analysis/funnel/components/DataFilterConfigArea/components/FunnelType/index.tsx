import React, { memo } from "react"
import { Radio } from "antd"
import { useQuery, useRouter } from "@/hooks"
import { IQuery } from "@pages/data-analysis/funnel/type"
import windowPeriod from "@pages/data-analysis/components/WindowPeriod"
import { FunnelTypeEnum } from "@probe-x/shared-types/src"
import * as styles from "./styles.module.scss"

function FunnelType() {

  const {
    funnelType,
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  const options = [{
    label: '按人数分析',
    value: FunnelTypeEnum.USER,
  }, {
    label: '按次数分析',
    value: FunnelTypeEnum.COUNT,
  }]

  if (!windowPeriod) {
    return null
  }

  return (
    <div className={styles.container}>
      <Radio.Group
        options={options}
        onChange={value => {
          refresh({
            funnelType: value.target.value,
          }, true)
        }}
        value={funnelType}
      />
    </div>
  )
}

export default memo(FunnelType)
