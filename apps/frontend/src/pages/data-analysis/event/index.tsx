import React, { useCallback, useEffect, useMemo } from "react"
import DataFilterConfigArea from "./components/DataFilterConfigArea"
import DataChat from "./components/DataChat"
import DataTable from "./components/DataTable"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import * as styles from "./styles.module.scss"
import { Button, notification, Spin } from "antd"
import { Download } from "@icon-park/react"
import { useLoading, useModel, useQuery, useRouter } from "@/hooks"
import { IDataAnalysisEventState, IQuery } from "@pages/data-analysis/event/type"
import dayjs from "dayjs"

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

  const download = useCallback(async () => {
    // 先检查填写项
    const flag = await dispatch.dataAnalysisEventModel.checkQueryParams()
    if (flag) {
      notification.error({ message: flag })
      return
    }
    dispatch.dataAnalysisEventModel.downloadData()
  }, [dispatch.dataAnalysisEventModel])

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
      </div>
    </Spin>
  )
}

export default EventAnalysis
