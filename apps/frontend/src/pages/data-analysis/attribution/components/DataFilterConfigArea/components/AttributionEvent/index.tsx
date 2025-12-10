import React, { memo, useCallback } from 'react'
import * as styles from './styles.module.scss'
import EventItem from "@pages/data-analysis/components/EventItem"
import { useQuery, useRouter } from "@/hooks"
import { IQuery } from "@pages/data-analysis/attribution/type"
import { AddOne } from "@icon-park/react"

const AttributionEvent: React.FC = () => {

  const {
    attributionEvent = [],
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  // 移除第index个事件
  const removeEvent = useCallback((index: number) => {
    const list = [...attributionEvent]
    list.splice(index, 1)
    refresh({
      attributionEvent: list,
    }, true)
  }, [attributionEvent, refresh])

  // 新增一个指标
  const addEvent = useCallback(() => {
    const list = [...attributionEvent]
    list.push({
      eventInfo: null,
    })
    refresh({
      attributionEvent: list,
    }, true)
  }, [attributionEvent, refresh])

  // 复制一个指标
  const copyEvent = useCallback((index: number) => {
    const list = [...attributionEvent]
    // 把第index个元素复制插入到第index+1的位置
    list.splice(index + 1, 0, { ...list[index] })
    refresh({
      attributionEvent: list,
    }, true)
  }, [attributionEvent, refresh])

  // 渲染事件选项列表
  const renderEventList = attributionEvent.map((event, index) => (
    <EventItem
      showFilter
      key={index}
      eventInfo={event.eventInfo}
      index={index}
      onRemove={() => removeEvent(index)}
      onCopy={() => copyEvent(index)}
      onChange={(eventInfo) => {
        const list = [...attributionEvent]
        list[index] = { eventInfo: eventInfo }
        refresh({
          attributionEvent: list,
        }, true)
      }}
    />
  ))

  return (
    <div className={styles.container}>
      {renderEventList}
      <a
        className={styles.addBtn}
        href="#"
        onClick={(e) => {
          e.preventDefault()
          addEvent()
        }}
      >
        <AddOne theme="filled" size="24" fill="#536DFE" style={{ display: 'flex' }} />
        添加归因事件
      </a>
    </div>
  )
}

export default memo(AttributionEvent)
