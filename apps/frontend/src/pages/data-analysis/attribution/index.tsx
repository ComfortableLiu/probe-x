import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button, message, Spin } from "antd"
import * as styles from "./styles.module.scss"
import DataAnalysisHeader from "@pages/data-analysis/components/DataAnalysisHeader"
import SaveAsDashboardPopup from "@pages/data-analysis/components/SaveAsDashboardPopup"
import { AnalysisType } from "@pages/data-analysis/dashboard-config/type"
import DataFilterConfigArea from "@pages/data-analysis/attribution/components/DataFilterConfigArea"
import DataTable from "@pages/data-analysis/attribution/components/DataTable"
import ContributionPieChart from "@pages/data-analysis/attribution/components/ContributionPieChart"
import AttributionFunnelChart from "@pages/data-analysis/attribution/components/AttributionFunnelChart"
import ModelComparisonBar from "@pages/data-analysis/attribution/components/ModelComparisonBar"
import DownloadPopup from "@pages/data-analysis/components/DownloadPopup"
import { useLoading, useModel, useQuery, useRouter } from "@/hooks"
import dayjs from "dayjs"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { IDataAnalysisAttributionState, IQuery } from "@pages/data-analysis/attribution/type"
import { AttributionModelEnum } from "@probe-x/shared-types/src"
import { ChartHistogram } from "@icon-park/react"

function AttributionAnalysis() {

  const dispatch = useDispatch<Dispatch>()

  const {
    updateTime,
    data,
  } = useModel<IDataAnalysisAttributionState>('dataAnalysisAttributionModel')

  const {
    timeRange,
    attributionModel,
    dashboardId,
  } = useQuery<IQuery & { dashboardId?: number }>()

  const {
    refresh,
  } = useRouter()

  const timer = useRef<NodeJS.Timeout>()

  const loading = useLoading()

  const pageLoading = useMemo(() => loading.dataAnalysisAttributionModel.init, [loading.dataAnalysisAttributionModel.init])

  // 显示下载弹窗
  const [showDownloadPopup, setShowDownloadPopup] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  // 显示保存为看板弹窗
  const [showSaveAsDashboardPopup, setShowSaveAsDashboardPopup] = useState(false)

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearInterval(timer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!timeRange || !attributionModel) {
      refresh({
        timeRange: timeRange || [dayjs().subtract(7, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
        attributionModel: attributionModel || AttributionModelEnum.FIRST_TOUCH,
      }, true)
    }
  }, [timeRange, attributionModel])

  useEffect(() => {
    dispatch.dataAnalysisAttributionModel.init()
  }, [dispatch.dataAnalysisAttributionModel])

  const queryDownloadTask = useCallback(async (taskId: string) => {
    const res = await dispatch.dataAnalysisAttributionModel.queryDownloadTask({ taskId })
    if (res?.status === 'SUCCESS' && res.downloadUrl) {
      // 下载文件
      setDownloadUrl(res.downloadUrl)
      if (timer.current) {
        clearInterval(timer.current)
      }
    }
  }, [dispatch.dataAnalysisAttributionModel])

  const download = useCallback(async () => {
    // 先检查填写项
    const flag = await dispatch.dataAnalysisAttributionModel.checkQueryParams()
    if (flag) {
      message.error(flag)
      return
    }
    setShowDownloadPopup(true)
    setDownloadUrl(null)
    if (timer.current) {
      clearInterval(timer.current)
    }
    const taskId = await dispatch.dataAnalysisAttributionModel.downloadData()
    if (taskId) {
      timer.current = setInterval(() => {
        queryDownloadTask(taskId)
      }, 1000)
    }
  }, [dispatch.dataAnalysisAttributionModel, queryDownloadTask])

  const handleSaveAsDashboard = useCallback(() => {
    // 先检查填写项
    dispatch.dataAnalysisAttributionModel.checkQueryParams().then((flag) => {
      if (flag) {
        message.error(flag)
        return
      }
      setShowSaveAsDashboardPopup(true)
    })
  }, [dispatch.dataAnalysisAttributionModel])

  // 触发模型对比查询
  const handleModelComparison = useCallback(() => {
    dispatch.dataAnalysisAttributionModel.queryAllModels()
  }, [dispatch.dataAnalysisAttributionModel])

  return (
    <Spin spinning={pageLoading}>
      <div className={styles.container}>
        <DataAnalysisHeader
          title="归因分析"
          updateTime={updateTime}
          download={download}
          onSaveAsDashboard={!dashboardId ? handleSaveAsDashboard : undefined}
          guidePath="/guide/data-analysis/attribution"
        />
        <DataFilterConfigArea />
        <div className={styles.hr} />

        {/* 图表区域 */}
        <div className={styles.chartRow}>
          <div className={styles.chartHalf}>
            <ContributionPieChart />
          </div>
          <div className={styles.chartHalf}>
            <AttributionFunnelChart />
          </div>
        </div>

        {/* 模型对比区域 */}
        <div className={styles.modelComparisonSection}>
          <div className={styles.modelComparisonHeader}>
            <Button
              type="default"
              onClick={handleModelComparison}
              loading={loading.dataAnalysisAttributionModel.queryAllModels}
              disabled={!data?.tableData?.length}
            >
              <ChartHistogram style={{ display: 'flex' }} theme="outline" size="14" />
              模型对比
            </Button>
          </div>
          <ModelComparisonBar />
        </div>

        <div className={styles.hr} />
        <DataTable />
        <DownloadPopup
          downloadUrl={downloadUrl}
          onClose={() => setShowDownloadPopup(false)}
          show={showDownloadPopup}
        />
        <SaveAsDashboardPopup
          analysisType={AnalysisType.ATTRIBUTION}
          open={showSaveAsDashboardPopup}
          onClose={() => setShowSaveAsDashboardPopup(false)}
          onSuccess={() => {
            message.success('看板已创建，可在首页查看')
          }}
        />
      </div>
    </Spin>
  )
}

export default AttributionAnalysis
