import React, { memo } from "react"
import { useQuery, useRouter } from "@/hooks"
import * as styles from "./styles.module.scss"
import { IQuery } from "@pages/data-analysis/attribution/type"
import EventItem from "@pages/data-analysis/components/EventItem"

function TargetMetrics() {

  const {
    targetMetric,
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  return (
    <div className={styles.container}>
      <EventItem
        singleMode
        showFilter
        eventInfo={targetMetric?.eventInfo}
        index={0}
        onChange={value => {
          refresh({
            targetMetric: {
              ...targetMetric,
              eventInfo: value,
            },
          }, true)
        }}
      />
    </div>
  )
}

export default memo(TargetMetrics)
