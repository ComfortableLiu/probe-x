import React, { memo, useCallback } from "react"
import { useRouter } from "@/hooks"
import { Button, message, Space } from 'antd'
import * as styles from "./styles.module.scss"
import { Refresh, Search } from "@icon-park/react"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import DataFilterConfigAreaItem from "@pages/data-analysis/components/DataFilterConfigAreaItem"
import TimeRangeSelector from "@pages/data-analysis/components/TimeRangeSelector"
import WindowPeriod from "@pages/data-analysis/components/WindowPeriod"
import EventSelector from "./components/EventSelector"
import CenterEvent from "@pages/data-analysis/user-path/components/DataFilterConfigArea/components/CenterEvent"

function DataFilterConfigArea() {

  const dispatch = useDispatch<Dispatch>()

  const {
    refresh,
  } = useRouter()

  // 提交查询任务
  const submit = useCallback(async () => {
    // 先检查填写项
    const flag = await dispatch.dataAnalysisFunnelModel.checkQueryParams()
    if (flag) {
      message.error(flag)
      return
    }
    dispatch.dataAnalysisFunnelModel.submitQuery()
  }, [dispatch.dataAnalysisFunnelModel])

  return (
    <div className={styles.container}>
      {/* 窗口期 */}
      <DataFilterConfigAreaItem
        title="窗口期"
        content={<WindowPeriod />}
      />
      <div className={styles.hr} />

      {/* 事件选择 */}
      <DataFilterConfigAreaItem
        title="事件选择"
        content={<EventSelector />}
      />
      <div className={styles.hr} />

      {/* 事件起点终点设置 */}
      <DataFilterConfigAreaItem
        title="事件定义"
        content={<CenterEvent />}
      />
      <div className={styles.hr} />

      {/* 时间范围 */}
      <DataFilterConfigAreaItem
        title="时间范围"
        content={<TimeRangeSelector />}
      />
      <div className={styles.hr} />

      {/* 操作按钮 */}
      <div className={styles.btnContainer}>
        <Space>
          <Button
            type="primary"
            size="large"
            onClick={() => submit()}
          >
            <Search style={{ display: 'flex' }} theme="outline" size="14" fill="#FFFFFF" />
            查询
          </Button>
          <Button
            type="default"
            size="large"
            onClick={() => refresh({})}
          >
            <Refresh style={{ display: 'flex' }} theme="outline" size="14" fill="#000000" />
            重置
          </Button>
        </Space>
      </div>
    </div>
  )
}

export default memo(DataFilterConfigArea)
