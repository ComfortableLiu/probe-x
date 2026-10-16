import React, { memo, useCallback } from "react"
import { useQuery, useRouter } from "@/hooks"
import { IEventAnalysisInfo, Metrics } from "@probe-x/shared-types/src"
import EventItem from "@pages/data-analysis/components/EventItem"
import { IQuery } from "@pages/data-analysis/retention/type"

interface IRetentionEventProps {
  // 读写 URL 的字段名（起始事件 startEvent / 回访事件 returnEvent）
  queryKey: 'startEvent' | 'returnEvent'
}

function RetentionEvent(props: IRetentionEventProps) {

  const {
    queryKey,
  } = props

  const query = useQuery<IQuery>()
  const event = query[queryKey]

  const {
    refresh,
  } = useRouter()

  // EventItem 的值是 IEventAnalysisInfo（带 metrics），写回时转换为留存的 {eventName, filters}
  const handleChange = useCallback((value: IEventAnalysisInfo) => {
    refresh({
      [queryKey]: {
        eventName: value?.eventName || '',
        filters: value?.filters,
      },
    }, true)
  }, [queryKey, refresh])

  return (
    <EventItem
      singleMode
      showFilter
      showMetric={false}
      eventInfo={event ? { ...event, metrics: Metrics.COUNT } : null}
      index={0}
      onChange={handleChange}
    />
  )
}

export default memo(RetentionEvent)
