import React, { memo, useEffect } from "react"
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

  useEffect(() => {
    if (!eventList?.length || eventList.indexOf(startEvent || endEvent) < 0) {
      refresh({
        startEvent: undefined,
        endEvent: undefined,
      }, true)
    }
  }, [eventList])

  useEffect(() => {
    if (endEvent) {
      setType(2)
    } else {
      setType(1)
    }
  }, [startEvent, endEvent])

  useEffect(() => {
    const eventName = startEvent || endEvent
    refresh({
      startEvent: type !== 2 ? eventName : undefined,
      endEvent: type === 2 ? eventName : undefined,
    }, true)
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
