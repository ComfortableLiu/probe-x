import React, { memo } from "react"
import { useQuery, useRouter } from "@/hooks"
import * as styles from "./styles.module.scss"
import { Radio } from "antd"
import { IQuery } from "@pages/data-analysis/attribution/type"
import { AttributionModelEnum } from "@probe-x/shared-types/src"

function AttributionModel() {

  const {
    attributionModel,
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  const options = [{
    label: '首次触点归因',
    value: AttributionModelEnum.FIRST_TOUCH,
  }, {
    label: '末次触点归因',
    value: AttributionModelEnum.LAST_TOUCH,
  }, {
    label: '线性归因',
    value: AttributionModelEnum.LINEAR,
  }, {
    label: '位置归因',
    value: AttributionModelEnum.POSITION,
  }, {
    label: '时间衰减归因',
    value: AttributionModelEnum.TIME_DECAY,
  }]

  return (
    <div className={styles.container}>
      <Radio.Group
        options={options}
        onChange={value => {
          refresh({
            attributionModel: value.target.value,
          }, true)
        }}
        value={attributionModel}
      />
    </div>
  )
}

export default memo(AttributionModel)
