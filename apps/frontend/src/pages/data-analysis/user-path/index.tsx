import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { useLoading, useModel, useQuery, useRouter } from "@/hooks"
import { IDataAnalysisUserPathState } from "@pages/data-analysis/user-path/type"
import { message, Spin } from "antd"
import * as styles from "./styles.module.scss"
import DataAnalysisHeader from "@pages/data-analysis/components/DataAnalysisHeader"
import SaveAsDashboardPopup from "@pages/data-analysis/components/SaveAsDashboardPopup"
import { AnalysisType } from "@pages/data-analysis/dashboard-config/type"
import DataFilterConfigArea from "@pages/data-analysis/user-path/components/DataFilterConfigArea"
import DataChat from "@pages/data-analysis/user-path/components/DataChat"
import DownloadPopup from "@pages/data-analysis/components/DownloadPopup"
import dayjs from "dayjs"
import { IQuery } from "@pages/data-analysis/event/type"

function UserPathAnalysis() {

  const dispatch = useDispatch<Dispatch>()

  const {
    updateTime,
  } = useModel<IDataAnalysisUserPathState>('dataAnalysisUserPathModel')

  const {
    timeRange,
    dashboardId,
  } = useQuery<IQuery & { dashboardId?: number }>()

  const {
    refresh,
  } = useRouter()

  const timer = useRef<NodeJS.Timeout>()

  const loading = useLoading()

  const pageLoading = useMemo(() => loading.dataAnalysisUserPathModel.init, [loading.dataAnalysisUserPathModel.init])

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
    dispatch.dataAnalysisUserPathModel.init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 使用 ref 跟踪是否已经初始化，避免重复刷新
  const timeRangeInitialized = useRef(false)

  useEffect(() => {
    // 只在首次加载且 timeRange 为空时设置默认值
    if (!timeRangeInitialized.current && !timeRange) {
      timeRangeInitialized.current = true
      refresh({
        timeRange: [dayjs().subtract(7, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
      }, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const queryDownloadTask = useCallback(async (taskId: string) => {
    const res = await dispatch.dataAnalysisUserPathModel.queryDownloadTask({ taskId })
    if (res?.status === 'SUCCESS' && res.downloadUrl) {
      // 下载文件
      setDownloadUrl(res.downloadUrl)
      if (timer.current) {
        clearInterval(timer.current)
      }
    }
  }, [dispatch.dataAnalysisUserPathModel])

  const download = useCallback(async () => {
    // 先检查填写项
    const flag = await dispatch.dataAnalysisUserPathModel.checkQueryParams()
    if (flag) {
      message.error(flag)
      return
    }
    setShowDownloadPopup(true)
    setDownloadUrl(null)
    if (timer.current) {
      clearInterval(timer.current)
    }
    const taskId = await dispatch.dataAnalysisUserPathModel.downloadData()
    if (taskId) {
      timer.current = setInterval(() => {
        queryDownloadTask(taskId)
      }, 1000)
    }
  }, [dispatch.dataAnalysisUserPathModel, queryDownloadTask])

  const handleSaveAsDashboard = useCallback(() => {
    // 先检查填写项
    dispatch.dataAnalysisUserPathModel.checkQueryParams().then((flag) => {
      if (flag) {
        message.error(flag)
        return
      }
      setShowSaveAsDashboardPopup(true)
    })
  }, [dispatch.dataAnalysisUserPathModel])

  return (
    <Spin spinning={pageLoading}>
      <div className={styles.container}>
        <DataAnalysisHeader
          title="用户路径分析"
          updateTime={updateTime}
          download={download}
          onSaveAsDashboard={!dashboardId ? handleSaveAsDashboard : undefined}
          guidePath="/guide/data-analysis/user-path"
        />
        <DataFilterConfigArea />
        <div className={styles.hr} />
        <DataChat />
        <DownloadPopup
          downloadUrl={downloadUrl}
          onClose={() => setShowDownloadPopup(false)}
          show={showDownloadPopup}
        />
        <SaveAsDashboardPopup
          analysisType={AnalysisType.USER_PATH}
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

export default UserPathAnalysis
