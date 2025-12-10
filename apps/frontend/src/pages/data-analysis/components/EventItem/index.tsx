import React, { memo, useCallback, useMemo } from "react"
import { IAttributionAnalysisFilter, IEventAnalysisInfo, MetaPropertyType, Metrics } from "@probe-x/shared-types/src"
import { Select, Tooltip } from "antd"
import { useModel } from "@/hooks"
import { IPointState } from "@/store/models/point/type"
import * as styles from "./styles.module.scss"
import { CopyOne, Delete, Filter } from "@icon-park/react"
import FilterSelector from "@pages/data-analysis/components/FilterSelector"

interface IEventItemProps {
  eventInfo: IEventAnalysisInfo | null
  index: number
  // 单点模式
  singleMode?: boolean
  // 是否展示筛选选项
  showFilter?: boolean
  // 点击移除
  onRemove?: () => void
  // 点击复制
  onCopy?: () => void
  // 修改值
  onChange?: (value: IEventAnalysisInfo) => void
}

function EventItem(props: IEventItemProps) {

  const {
    singleMode,
    eventInfo,
    index,
    showFilter,
    onCopy,
    onRemove,
    onChange,
  } = props

  const {
    eventList = [],
  } = useModel<IPointState>('pointModel')

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

  const addFilter = useCallback(() => {
    if (!onChange) return
    onChange({
      ...eventInfo,
      filters: [...(eventInfo?.filters || []), {
        propertyName: '',
        propertyType: MetaPropertyType.STRING,
        propertyValue: [],
        compareType: 'EQUAL',
      } as IAttributionAnalysisFilter],
    })
  }, [eventInfo, onChange])

  const onEventChange = useCallback((value: string) => {
    onChange({
      ...eventInfo,
      metrics: eventInfo?.metrics ? eventInfo?.metrics : Metrics.COUNT,
      eventName: value,
    })
  }, [eventInfo, onChange])

  const onMetricChange = useCallback((value: Metrics) => {
    onChange({
      ...eventInfo,
      metrics: value,
    })
  }, [eventInfo, onChange])

  const renderOperate = useMemo(() => (
    <div className={styles.operate}>
      {showFilter ?
        <a href="#" className={styles.operateBtn} onClick={() => addFilter()}>
          <Filter className={styles.icon} theme="outline" size="14" fill="#333" />
          增加筛选
        </a>
        : null}
      {singleMode ? null :
        <>
          <a href="#" className={styles.operateBtn} onClick={() => onCopy?.()}>
            <CopyOne className={styles.icon} theme="outline" size="14" fill="#333" />
            复制
          </a>
          <a href="#" className={styles.operateBtn} onClick={() => onRemove?.()}>
            <Delete className={styles.icon} theme="outline" size="14" fill="#333" />
            移除
          </a>
        </>
      }
    </div>
  ), [addFilter, onCopy, onRemove, showFilter, singleMode])

  return (
    <div className={styles.container}>
      <div className={styles.eventContainer}>
        {singleMode ? null :
          <div className={styles.tag}>
            {String.fromCharCode(index + 65)}
          </div>
        }
        <Select
          allowClear
          className={styles.selectEvent}
          onChange={onEventChange}
          options={eventSelectOptions}
          value={eventInfo?.eventName}
          placeholder="选择一个事件"
        />
        <span>的</span>
        <Select
          className={styles.selectMetric}
          onChange={onMetricChange}
          value={eventInfo?.metrics || Metrics.COUNT}
          options={[{
            label: '总次数',
            value: Metrics.COUNT,
          }, {
            label: '用户数',
            value: Metrics.USERS,
          }, {
            label: '会话数',
            value: Metrics.SESSIONS,
          }]}
          placeholder="选择指标"
        />
        {renderOperate}
      </div>
      <FilterSelector
        styles={{ marginLeft: 32 }}
        value={eventInfo?.filters}
        onChange={(value) => {
          onChange({
            ...eventInfo,
            filters: value,
          })
        }}
      />
    </div>
  )
}

export default memo(EventItem)
