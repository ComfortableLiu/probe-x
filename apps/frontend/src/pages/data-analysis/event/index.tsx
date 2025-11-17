import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import DataFilterConfigArea from "./components/DataFilterConfigArea"
import DataChat from "./components/DataChat"
import DataTable from "./components/DataTable"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import * as styles from "./styles.module.scss"
import { Button, message, Spin } from "antd"
import { Download } from "@icon-park/react"
import { useLoading, useModel, useQuery, useRouter } from "@/hooks"
import { IDataAnalysisEventState, IQuery } from "./type"
import dayjs from "dayjs"
import DownloadPopup from "./components/DownloadPopup"

function EventAnalysis() {

  const dispatch = useDispatch<Dispatch>()

  const {
    updateTime,
  } = useModel<IDataAnalysisEventState>('dataAnalysisEventModel')

  const {
    timeRange,
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  const timer = useRef(undefined)

  // 显示下载弹窗
  const [showDownloadPopup, setShowDownloadPopup] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => clearInterval(timer.current)
  }, [timer])

  useEffect(() => {
    if (!timeRange) {
      refresh({
        timeRange: [dayjs().subtract(7, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
      }, true)
    }
  }, [timeRange])

  useEffect(() => {
    dispatch.dataAnalysisEventModel.init()
  }, [dispatch.dataAnalysisEventModel])

  const loading = useLoading()

  const pageLoading = useMemo(() => loading.dataAnalysisEventModel.init, [loading.dataAnalysisEventModel.init])

  const queryDownloadTask = useCallback(async (taskId: string) => {
    const res = await dispatch.dataAnalysisEventModel.queryDownloadTask({ taskId })
    if (res.status === 'SUCCESS' && res.downloadUrl) {
      // 下载文件
      setDownloadUrl(res.downloadUrl)
      // downloadFile(res.downloadUrl)
      clearInterval(timer.current)
    }
  }, [dispatch.dataAnalysisEventModel])

  const download = useCallback(async () => {
    // 先检查填写项
    const flag = await dispatch.dataAnalysisEventModel.checkQueryParams()
    if (flag) {
      message.error(flag)
      return
    }
    setShowDownloadPopup(true)
    setDownloadUrl(null)
    clearInterval(timer.current)
    const taskId = await dispatch.dataAnalysisEventModel.downloadData()
    timer.current = setInterval(() => {
      queryDownloadTask(taskId)
    }, 1000)
  }, [dispatch.dataAnalysisEventModel, queryDownloadTask])

  return (
    <Spin spinning={pageLoading}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.title}>事件分析</div>
          {updateTime ? <div>更新时间：{dayjs(updateTime).format('YYYY-MM-DD HH:mm:ss')}</div> : null}
          <Button
            type="link"
            onClick={() => download()}
          >
            <Download theme="filled" size="16" fill="#333" />
            下载
          </Button>
        </div>
        <DataFilterConfigArea />
        <div className={styles.hr} />
        <DataChat />
        <div className={styles.hr} />
        <DataTable />
        <DownloadPopup
          downloadUrl={downloadUrl}
          onClose={() => setShowDownloadPopup(false)}
          show={showDownloadPopup}
        />
      </div>
    </Spin>
  )
}

export default EventAnalysis
