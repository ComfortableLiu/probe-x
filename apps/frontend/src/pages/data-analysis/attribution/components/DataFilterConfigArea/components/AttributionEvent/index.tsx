import React, { memo } from 'react'
import * as styles from './styles.module.scss'
import EventItem from "@pages/data-analysis/components/EventItem"
import { useQuery, useRouter } from "@/hooks"
import { IQuery } from "@pages/data-analysis/attribution/type"

const AttributionEvent: React.FC = () => {

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

export default memo(AttributionEvent)
