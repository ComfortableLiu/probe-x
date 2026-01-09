import React, { memo, useEffect, useRef } from "react"
import { useQuery, useRouter } from "@/hooks"
import { IQuery } from "@pages/data-analysis/user-path/type"
import { Radio, Select } from "antd"
import * as styles from "./styles.module.scss"

function CenterEvent() {

  const {
    eventList = [],
    startEvent,
    endEvent,
  } = useQuery<IQuery>()

  const { refresh } = useRouter()

  // 选择起点还是终点
  const [type, setType] = React.useState<1 | 2>(1)

  // 使用 ref 跟踪上一次的值，避免不必要的刷新
  const prevEventListRef = useRef<string[]>([])
  const prevStartEventRef = useRef<string | undefined>(undefined)
  const prevEndEventRef = useRef<string | undefined>(undefined)
  const prevTypeRef = useRef<1 | 2>(1)
  const isInitializedRef = useRef(false)

  // 初始化 type 状态
  useEffect(() => {
    if (!isInitializedRef.current) {
      const initialType = endEvent ? 2 : (startEvent ? 1 : 1)
      if (initialType !== type) {
        setType(initialType)
      }
      isInitializedRef.current = true
      prevEventListRef.current = eventList
      prevStartEventRef.current = startEvent
      prevEndEventRef.current = endEvent
      prevTypeRef.current = initialType
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 检查 eventList 变化，如果当前选中的事件不在列表中，清除选择
  useEffect(() => {
    // 只在 eventList 真正变化时检查
    const eventListChanged = JSON.stringify(prevEventListRef.current) !== JSON.stringify(eventList)
    if (eventListChanged && eventList?.length) {
      const currentEvent = startEvent || endEvent
      if (currentEvent && eventList.indexOf(currentEvent) < 0) {
        // 只有当值真的需要改变时才刷新
        if (startEvent !== undefined || endEvent !== undefined) {
          prevStartEventRef.current = undefined
          prevEndEventRef.current = undefined
          refresh({
            startEvent: undefined,
            endEvent: undefined,
          }, true)
        }
      }
      prevEventListRef.current = eventList
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventList])

  // 同步 startEvent 和 endEvent 到 type（只在初始化后且值真正变化时）
  useEffect(() => {
    if (!isInitializedRef.current) return
    
    // 检查值是否真的变化了
    const startEventChanged = prevStartEventRef.current !== startEvent
    const endEventChanged = prevEndEventRef.current !== endEvent
    
    if (startEventChanged || endEventChanged) {
      if (endEvent && type !== 2) {
        setType(2)
        prevTypeRef.current = 2
      } else if (startEvent && !endEvent && type !== 1) {
        setType(1)
        prevTypeRef.current = 1
      }
      prevStartEventRef.current = startEvent
      prevEndEventRef.current = endEvent
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startEvent, endEvent])

  // 当 type 改变时，更新 startEvent 和 endEvent
  useEffect(() => {
    // 只在 type 真正变化时更新
    if (prevTypeRef.current === type) return
    
    const eventName = startEvent || endEvent
    if (!eventName) {
      prevTypeRef.current = type
      return
    }
    
    const currentStartEvent = type !== 2 ? eventName : undefined
    const currentEndEvent = type === 2 ? eventName : undefined
    
    // 只有当值真的需要改变时才刷新
    if (currentStartEvent !== startEvent || currentEndEvent !== endEvent) {
      prevTypeRef.current = type
      prevStartEventRef.current = currentStartEvent
      prevEndEventRef.current = currentEndEvent
      refresh({
        startEvent: currentStartEvent,
        endEvent: currentEndEvent,
      }, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  return (
    <div className={styles.container}>
      <Select
        disabled={!eventList.length}
        placeholder="请选择事件"
        style={{ width: 200 }}
        value={startEvent || endEvent}
        onChange={(value) => {
          refresh({
            startEvent: type !== 2 ? value : undefined,
            endEvent: type === 2 ? value : undefined,
          }, true)
        }}
        options={eventList.map(item => ({
          label: item,
          value: item,
        }))}
      />
      <Radio.Group
        disabled={!eventList.length}
        onChange={value => setType(value.target.value)}
        value={type}
        options={[
          { value: 1, label: '起点' },
          { value: 2, label: '终点' },
        ]}
      />
    </div>
  )
}

export default memo(CenterEvent)
