import React, { memo, useCallback } from "react"
import { useRouter } from "@/hooks"
import { Button, message, Space } from 'antd'
import * as styles from "./styles.module.scss"
import { Refresh, Search } from "@icon-park/react"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import DataFilterConfigAreaItem from "@pages/data-analysis/components/DataFilterConfigAreaItem"
import GlobalFilter from "@pages/data-analysis/components/GlobalFilter"
import TimeRangeSelector from "@pages/data-analysis/components/TimeRangeSelector"
import AttributionModel from "./components/AttributionModel"
import TargetMetrics from "./components/TargetMetrics"
import DimensionSelector from "@pages/data-analysis/components/DimensionSelector"
import AttributionEvent from "./components/AttributionEvent"

function DataFilterConfigArea() {

  const dispatch = useDispatch<Dispatch>()

  const {
    refresh,
  } = useRouter()

  // 提交查询任务
  const submit = useCallback(async () => {
    // 先检查填写项
    const flag = await dispatch.dataAnalysisAttributionModel.checkQueryParams()
    if (flag) {
      message.error(flag)
      return
    }
    dispatch.dataAnalysisAttributionModel.submitQuery()
  }, [dispatch.dataAnalysisAttributionModel])

  return (
    <div className={styles.container}>
      {/* 归因模型 */}
      <DataFilterConfigAreaItem
        title="归因模型"
        content={<AttributionModel />}
      />
      <div className={styles.hr} />

      {/* 转化指标 */}
      <DataFilterConfigAreaItem
        title="转化指标"
        content={<TargetMetrics />}
      />

      {/* 转化指标维度 */}
      <DataFilterConfigAreaItem
        title="转化指标维度"
        content={<DimensionSelector queryKey="targetDimension" />}
      />
      <div className={styles.hr} />

      {/* 归因事件 */}
      <DataFilterConfigAreaItem
        title="归因事件"
        content={<AttributionEvent />}
      />

      {/* 归因事件维度 */}
      <DataFilterConfigAreaItem
        title="归因事件维度"
        content={<DimensionSelector queryKey="attributionEventDimension" />}
      />
      <div className={styles.hr} />

      {/* 全局筛选部分 */}
      <DataFilterConfigAreaItem
        title="全局筛选"
        content={<GlobalFilter />}
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
