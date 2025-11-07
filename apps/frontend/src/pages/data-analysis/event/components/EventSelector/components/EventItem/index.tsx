import React, { memo, useCallback, useMemo } from "react"
import { IEventInfo } from "@pages/data-analysis/event/type"
import { Button, Select, Tooltip } from "antd"
import { useModel } from "@/hooks"
import { IPointState } from "@/store/models/point/type"
import * as styles from "./styles.module.scss"
import { CopyOne, Filter } from "@icon-park/react"

interface IEventItemProps {
  eventInfo: IEventInfo | null
}

function EventItem(props: IEventItemProps) {

  const {
    eventInfo,
  } = props

  const {
    eventList = [],
  } = useModel<IPointState>('pointModel')

  const onChange = useCallback((value: string) => {
    console.log(value)
  }, [])

  const eventSelectOptions = useMemo(() => eventList.map(event => ({
    label: (
      <Tooltip
        placement="topLeft"
        title={(
          <label>
            {event.eventRemark}
            <br />
            {event.eventAliases}
          </label>
        )}
      >
        {event.eventName}
      </Tooltip>
    ),
    value: event.eventName,
  })), [eventList])

  return (
    <div className={styles.container}>
      <Select
        allowClear
        className={styles.selectEvent}
        onChange={onChange}
        options={eventSelectOptions}
        placeholder="选择一个事件"
      />
      <span>的</span>
      <Select
        allowClear
        className={styles.selectMetric}
        onChange={onChange}
        options={[{
          label: '总次数',
          value: 'count',
        }, {
          label: '用户数',
          value: 'user',
        }, {
          label: '会话数',
          value: 'session',
        }]}
        placeholder="选择指标"
      />

      <Button type="link">
        <Filter theme="outline" size="16" fill="#333" />
        筛选
      </Button>
      <Button type="link">
        <CopyOne theme="outline" size="16" fill="#333" />
        复制
      </Button>
    </div>
  )
}

export default memo(EventItem)
