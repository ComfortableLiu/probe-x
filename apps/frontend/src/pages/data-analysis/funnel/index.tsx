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
    querySnapshot,
  } = useModel<IDataAnalysisFunnelState>('dataAnalysisFunnelModel')

  const {
    timeRange,
    windowPeriod,
    funnelType,
    funnelInfoList,
    dashboardId,
  } = useQuery<IQuery & { dashboardId?: number }>()

  const {
    refresh,
  } = useRouter()

  const timer = useRef<NodeJS.Timeout>(null)

  // 标记本次挂载是否已通过快照恢复参数，避免与默认值填充逻辑冲突
  const restoredRef = useRef(false)

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

  // 从其他页面返回且 URL 无查询参数时，恢复上一次查询的筛选项（结果数据在 model 中，由快照渲染）
  useEffect(() => {
    if (!funnelInfoList?.length && !dashboardId && querySnapshot) {
      restoredRef.current = true
      refresh({ ...querySnapshot }, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!timeRange || !windowPeriod || !funnelType) {
      // 快照恢复时会带回这些参数，这里跳过一次默认值填充
      if (restoredRef.current) {
        restoredRef.current = false
        return
      }
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
    try {
      const res = await dispatch.dataAnalysisFunnelModel.queryDownloadTask({ taskId })
      if (res?.status === 'SUCCESS' && res.downloadUrl) {
        // 下载文件
        setDownloadUrl(res.downloadUrl)
        if (timer.current) {
          clearInterval(timer.current)
        }
      } else if (res?.status === 'FAIL') {
        message.error('下载任务失败，请重试')
        if (timer.current) {
          clearInterval(timer.current)
        }
      }
    } catch (error) {
      // 查询异常时停止轮询，避免无限重试
      message.error('查询下载任务状态失败')
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
      // 最多轮询 300 次，超时停止避免无限轮询
      let pollCount = 0
      timer.current = setInterval(() => {
        pollCount += 1
        if (pollCount > 300) {
          if (timer.current) {
            clearInterval(timer.current)
          }
          message.warning('下载任务超时，请重试')
          return
        }
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
