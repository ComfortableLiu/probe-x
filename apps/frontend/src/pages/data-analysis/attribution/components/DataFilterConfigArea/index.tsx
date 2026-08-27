import React, { memo, useCallback, useState } from "react"
import { useRouter, useQuery } from "@/hooks"
import { Button, message, Space } from 'antd'
import * as styles from "./styles.module.scss"
import { Refresh, Search, Save } from "@icon-park/react"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import DataFilterConfigAreaItem from "@pages/data-analysis/components/DataFilterConfigAreaItem"
import GlobalFilter from "@pages/data-analysis/components/GlobalFilter"
import TimeRangeSelector from "@pages/data-analysis/components/TimeRangeSelector"
import AttributionModel from "./components/AttributionModel"
import TargetMetrics from "./components/TargetMetrics"
import DimensionSelector from "@pages/data-analysis/components/DimensionSelector"
import AttributionEvent from "./components/AttributionEvent"
import SaveAsDashboardPopup from "@pages/data-analysis/components/SaveAsDashboardPopup"
import { AnalysisType } from "@pages/data-analysis/dashboard-config/type"
import { getDashboard } from "@pages/data-analysis/dashboard-config/services"

function DataFilterConfigArea() {

  const dispatch = useDispatch<Dispatch>()

  const {
    refresh,
  } = useRouter()

  const { dashboardId } = useQuery<{ dashboardId?: number }>()
  const [showSaveAsDashboardPopup, setShowSaveAsDashboardPopup] = useState(false)
  const [dashboardInfo, setDashboardInfo] = useState<{ name?: string; displayChart?: boolean; displayTable?: boolean }>({})

  // 如果有dashboardId，加载看板信息
  React.useEffect(() => {
    if (dashboardId) {
      getDashboard(dashboardId).then(({ data }) => {
        if (data) {
          setDashboardInfo({
            name: data.name,
            displayChart: data.displayChart,
            displayTable: data.displayTable,
          })
        }
      }).catch(() => {
        // 忽略错误
      })
    }
  }, [dashboardId])

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

  // 保存模板（更新看板）
  const handleSaveTemplate = useCallback(async () => {
    // 先检查填写项
    const flag = await dispatch.dataAnalysisAttributionModel.checkQueryParams()
    if (flag) {
      message.error(flag)
      return
    }
    setShowSaveAsDashboardPopup(true)
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
          {dashboardId && (
            <Button
              type="primary"
              size="large"
              onClick={handleSaveTemplate}
            >
              <Save style={{ display: 'flex' }} theme="outline" size="14" fill="#FFFFFF" />
              保存模板
            </Button>
          )}
          <Button
            type="default"
            size="large"
            onClick={() => refresh({})}
          >
            <Refresh style={{ display: 'flex' }} theme="outline" size="14" fill="currentColor" />
            重置
          </Button>
        </Space>
      </div>
      {dashboardId && (
        <SaveAsDashboardPopup
          analysisType={AnalysisType.ATTRIBUTION}
          dashboardId={dashboardId}
          dashboardName={dashboardInfo.name}
          displayChart={dashboardInfo.displayChart}
          displayTable={dashboardInfo.displayTable}
          open={showSaveAsDashboardPopup}
          onClose={() => setShowSaveAsDashboardPopup(false)}
          onSuccess={() => {
            message.success('看板已更新')
          }}
        />
      )}
    </div>
  )
}

export default memo(DataFilterConfigArea)
