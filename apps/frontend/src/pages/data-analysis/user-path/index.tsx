import React, { useEffect, useMemo } from "react"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { useLoading, useModel, useQuery, useRouter } from "@/hooks"
import { IDataAnalysisUserPathState } from "@pages/data-analysis/user-path/type"
import { Spin } from "antd"
import * as styles from "./styles.module.scss"
import DataAnalysisHeader from "@pages/data-analysis/components/DataAnalysisHeader"
import DataFilterConfigArea from "@pages/data-analysis/user-path/components/DataFilterConfigArea"
import DataChat from "@pages/data-analysis/user-path/components/DataChat"
import dayjs from "dayjs"
import { IQuery } from "@pages/data-analysis/event/type"

function UserPathAnalysis() {

  const dispatch = useDispatch<Dispatch>()

  const {
    updateTime,
  } = useModel<IDataAnalysisUserPathState>('dataAnalysisUserPathModel')

  const {
    timeRange,
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  const loading = useLoading()

  const pageLoading = useMemo(() => loading.dataAnalysisUserPathModel.init, [loading.dataAnalysisUserPathModel.init])

  useEffect(() => {
    dispatch.dataAnalysisUserPathModel.init()
  }, [dispatch.dataAnalysisUserPathModel])

  useEffect(() => {
    if (!timeRange) {
      refresh({
        timeRange: [dayjs().subtract(7, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
      }, true)
    }
  }, [timeRange])

  return (
    <Spin spinning={pageLoading}>
      <div className={styles.container}>
        <DataAnalysisHeader
          title="用户路径分析"
          updateTime={updateTime}
        />
        <DataFilterConfigArea />
        <div className={styles.hr} />
        <DataChat />
      </div>
    </Spin>
  )
}

export default UserPathAnalysis
