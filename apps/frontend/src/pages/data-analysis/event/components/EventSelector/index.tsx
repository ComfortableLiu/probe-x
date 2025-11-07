import React, { memo, useMemo } from "react"
import { useQuery } from "@/hooks"
import { IQuery } from "@pages/data-analysis/event/type"
import EventItem from "./components/EventItem"
import { Button, DatePicker } from "antd"
import * as styles from "./styles.module.scss"
import { AddOne } from "@icon-park/react"
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

const { RangePicker } = DatePicker

function EventSelector() {

  const {
    eventInfoList = [],
    timeRange = [new Date(), new Date()],
    dimension = [],
  } = useQuery<IQuery>()

  // 渲染事件选项列表
  const renderEventList = useMemo(() => {
    if (!eventInfoList.length) {
      return (
        <EventItem eventInfo={null} />
      )
    }
    return eventInfoList.map(eventInfo => (
      <EventItem
        key={eventInfo.eventName}
        eventInfo={eventInfo}
      />
    ))
  }, [eventInfoList])

  return (
    <div className={styles.container}>

      {/* 事件部分 */}
      <div className={styles.selectorContainer}>
        <div className={styles.title}>事件选择</div>
        <div className={styles.content}>
          {renderEventList}
          <Button
            className={styles.addBtn}
            type="link"
            size="small"
          >
            <AddOne theme="outline" size="16" fill="#333" style={{ display: 'flex' }} />
            指标
          </Button>
        </div>
      </div>
      <div className={styles.hr} />

      {/* 全局筛选部分 */}
      <div className={styles.selectorContainer}>
        <div className={styles.title}>全局筛选</div>
        <div className={styles.content}>
          <Button
            className={styles.addBtn}
            type="link"
            size="small"
          >
            <AddOne theme="outline" size="16" fill="#333" style={{ display: 'flex' }} />
            筛选
          </Button>
        </div>
      </div>
      <div className={styles.hr} />

      {/* 事件维度 */}
      <div className={styles.selectorContainer}>
        <div className={styles.title}>事件维度</div>
        <div className={styles.content}>
          {dimension.map(item => (
            <div key={item}>{item}</div>
          ))}

          <Button
            className={styles.addBtn}
            type="default"
            size="small"
          >
            <AddOne theme="outline" size="16" fill="#333" style={{ display: 'flex' }} />
            增加
          </Button>
        </div>
      </div>
      <div className={styles.hr} />

      {/* 时间范围 */}
      <div className={styles.selectorContainer}>
        <div className={styles.title}>时间范围</div>
        <div className={styles.content}>
          <RangePicker
            allowClear
            maxDate={dayjs()}
            defaultValue={[dayjs(timeRange[0]), dayjs(timeRange[1])]}
          />
        </div>
      </div>
    </div>
  )
}

export default memo(EventSelector)
