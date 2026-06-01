import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as styles from "./styles.module.scss"
import { message, Spin } from "antd"
import { useLoading, useModel, useQuery, useRouter } from "@/hooks"
import DownloadPopup from "@pages/data-analysis/components/DownloadPopup"
import DataAnalysisHeader from "@pages/data-analysis/components/DataAnalysisHeader"
import SaveAsDashboardPopup from "@pages/data-analysis/components/SaveAsDashboardPopup"
import { IDataAnalysisFunnelState, IQuery } from "@pages/data-analysis/funnel/type"
import { AnalysisType } from "@pages/data-analysis/dashboard-config/type"
import dayjs from "dayjs"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { FunnelTypeEnum } from "@probe-x/shared-types/src"
import DataFilterConfigArea from "./components/DataFilterConfigArea"
import DataChat from "./components/DataChat"

function FunnelAnalysis() {

  const dispatch = useDispatch<Dispatch>()

  const {
    updateTime,
  } = useModel<IDataAnalysisFunnelState>('dataAnalysisFunnelModel')

  const {
    timeRange,
    windowPeriod,
    funnelType,
    dashboardId,
  } = useQuery<IQuery & { dashboardId?: number }>()

  const {
    refresh,
  } = useRouter()

  const timer = useRef<NodeJS.Timeout>(null)

  const loading = useLoading()

  const pageLoading = useMemo(() => loading.dataAnalysisFunnelModel.init, [loading.dataAnalysisFunnelModel.init])

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
    if (!timeRange || !windowPeriod || !funnelType) {
      refresh({
        timeRange: timeRange || [dayjs().subtract(7, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
        windowPeriod: windowPeriod || { unit: 'd', value: 7 },
        funnelType: funnelType || FunnelTypeEnum.USER,
      }, true)
    }
  }, [timeRange, windowPeriod, funnelType])

  useEffect(() => {
    dispatch.dataAnalysisEventModel.init()
  }, [dispatch.dataAnalysisEventModel])

  const queryDownloadTask = useCallback(async (taskId: string) => {
    const res = await dispatch.dataAnalysisFunnelModel.queryDownloadTask({ taskId })
    if (res?.status === 'SUCCESS' && res.downloadUrl) {
      // 下载文件
      setDownloadUrl(res.downloadUrl)
      if (timer.current) {
        clearInterval(timer.current)
      }
    }
  }, [dispatch.dataAnalysisFunnelModel])

  const download = useCallback(async () => {
    // 先检查填写项
    const flag = await dispatch.dataAnalysisFunnelModel.checkQueryParams()
    if (flag) {
      message.error(flag)
      return
    }
    setShowDownloadPopup(true)
    setDownloadUrl(null)
    if (timer.current) {
      clearInterval(timer.current)
    }
    const taskId = await dispatch.dataAnalysisFunnelModel.downloadData()
    if (taskId) {
      timer.current = setInterval(() => {
        queryDownloadTask(taskId)
      }, 1000)
    }
  }, [dispatch.dataAnalysisFunnelModel, queryDownloadTask])

  const handleSaveAsDashboard = useCallback(() => {
    // 先检查填写项
    dispatch.dataAnalysisFunnelModel.checkQueryParams().then((flag) => {
      if (flag) {
        message.error(flag)
        return
      }
      setShowSaveAsDashboardPopup(true)
    })
  }, [dispatch.dataAnalysisFunnelModel])

  return (
    <Spin spinning={pageLoading}>
      <div className={styles.container}>
        <DataAnalysisHeader
          title="漏斗分析"
          updateTime={updateTime}
          download={download}
          onSaveAsDashboard={!dashboardId ? handleSaveAsDashboard : undefined}
          guidePath="/guide/data-analysis/funnel"
        />
        <DataFilterConfigArea />
        <div className={styles.hr} />

        <DataChat />
        <div className={styles.hr} />

        <DownloadPopup
          downloadUrl={downloadUrl}
          onClose={() => setShowDownloadPopup(false)}
          show={showDownloadPopup}
        />
        <SaveAsDashboardPopup
          analysisType={AnalysisType.FUNNEL}
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

export default FunnelAnalysis
