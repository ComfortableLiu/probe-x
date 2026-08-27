import React, { memo } from "react"
import { useModel, useQuery, useRouter } from "@/hooks"
import { IQuery } from "@pages/data-analysis/user-path/type"
import { Select, Tooltip } from "antd"
import { IPointState } from "@/store/models/point/type"

function EventSelector() {

  const {
    eventList: events,
  } = useModel<IPointState>('pointModel')

  const {
    eventList,
  } = useQuery<IQuery>()

  const { refresh } = useRouter()

  return (
    <Select
      styles={{
        popup: {
          root: {
            width: 200,
          },
        },
      }}
      mode="multiple"
      placeholder="请选择事件"
      style={{ width: '100%' }}
      value={eventList}
      onChange={(value) => {
        refresh({
          eventList: value,
        }, true)
      }}
      options={events.map(item => ({
        label: (
          <Tooltip title={(
            <>
              {item.eventName}
              <br />
              {item.eventRemark}
            </>
          )}>
            {/* 别名可能为空，为空时回退展示事件名，避免下拉项空白 */}
            {item.eventAliases || item.eventName}
          </Tooltip>
        ),
        value: item.eventName,
      }))}
    />
  )
}

export default memo(EventSelector)
