import React, { memo, useCallback, useMemo } from "react"
import EventItem from "@pages/data-analysis/components/EventItem"
import { useQuery, useRouter } from "@/hooks"
import { IQuery } from "@pages/data-analysis/free/type"
import { Metrics } from "@probe-x/shared-types/src"
import { AddOne } from "@icon-park/react"

function EventSelector() {

  const {
    eventInfoList = [],
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  // 移除第index个事件
  const removeEvent = useCallback((index: number) => {
    const list = [...eventInfoList]
    list.splice(index, 1)
    refresh({
      eventInfoList: list,
    }, true)
  }, [eventInfoList, refresh])

  // 新增一个指标
  const addEvent = useCallback(() => {
    const list = [...eventInfoList]
    list.push({
      metrics: Metrics.COUNT,
    })
    refresh({
      eventInfoList: list,
    }, true)
  }, [eventInfoList, refresh])

  // 复制一个指标
  const copyEvent = useCallback((index: number) => {
    const list = [...eventInfoList]
    list.splice(index + 1, 0, { ...list[index] })
    refresh({
      eventInfoList: list,
    }, true)
  }, [eventInfoList, refresh])

  // 渲染事件选项列表
  const renderEventList = useMemo(() => {
    return eventInfoList.map((eventInfo, index) => (
      <EventItem
        showFilter
        key={index}
        eventInfo={eventInfo}
        index={index}
        onRemove={() => removeEvent(index)}
        onCopy={() => copyEvent(index)}
        onChange={(eventInfo) => {
          const list = [...eventInfoList]
          list[index] = eventInfo
          refresh({
            eventInfoList: list,
          }, true)
        }}
      />
    ))
  }, [copyEvent, eventInfoList, refresh, removeEvent])

  return (
    <div>
      {renderEventList}
      <a
        style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}
        href="#"
        onClick={(e) => { e.preventDefault(); addEvent() }}
      >
        <AddOne theme="filled" size="24" fill="#536DFE" style={{ display: 'flex' }} />
        添加指标
      </a>
    </div>
  )
}

export default memo(EventSelector)
