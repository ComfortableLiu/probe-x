import React, { memo, useCallback } from "react"
import { useRouter } from "@/hooks"
import { Button, message, Space } from 'antd'
import { Refresh, Search } from "@icon-park/react"
import EventSelector from "../EventSelector"
import GlobalFilter from "@pages/data-analysis/components/GlobalFilter"
import DimensionSelector from "@pages/data-analysis/components/DimensionSelector"
import TimeRangeSelector from "@pages/data-analysis/components/TimeRangeSelector"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import DataFilterConfigAreaItem from "@pages/data-analysis/components/DataFilterConfigAreaItem"
import * as styles from "./styles.module.scss"

function DataFilterConfigArea() {

  const dispatch = useDispatch<Dispatch>()

  const {
    refresh,
  } = useRouter()

  // 提交查询任务
  const submit = useCallback(async () => {
    // 先检查填写项
    const flag = await dispatch.dataAnalysisFreeModel.checkQueryParams()
    if (flag) {
      message.error(flag)
      return
    }
    dispatch.dataAnalysisFreeModel.submitQuery()
  }, [dispatch.dataAnalysisFreeModel])

  return (
    <div className={styles.container}>

      {/* 事件部分 */}
      <DataFilterConfigAreaItem
        title="事件选择"
        content={<EventSelector />}
      />
      <div className={styles.hr} />

      {/* 全局筛选部分 */}
      <DataFilterConfigAreaItem
        title="全局筛选"
        content={<GlobalFilter />}
      />
      <div className={styles.hr} />

      {/* 数据维度 */}
      <DataFilterConfigAreaItem
        title="数据维度"
        content={<DimensionSelector />}
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
