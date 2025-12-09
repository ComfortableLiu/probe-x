import React, { useEffect, useMemo } from "react"
import { Spin } from "antd"
import * as styles from "./styles.module.scss"
import DataAnalysisHeader from "@pages/data-analysis/components/DataAnalysisHeader"
import DataFilterConfigArea from "@pages/data-analysis/attribution/components/DataFilterConfigArea"
import DataTable from "@pages/data-analysis/attribution/components/DataTable"
import { useLoading, useModel, useQuery, useRouter } from "@/hooks"
import dayjs from "dayjs"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { IDataAnalysisAttributionState, IQuery } from "@pages/data-analysis/attribution/type"
import { AttributionModelEnum } from "@probe-x/shared-types/src"

function AttributionAnalysis() {

  const dispatch = useDispatch<Dispatch>()

  const {
    updateTime,
  } = useModel<IDataAnalysisAttributionState>('dataAnalysisAttributionModel')

  const {
    timeRange,
    attributionModel,
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  const loading = useLoading()

  const pageLoading = useMemo(() => loading.dataAnalysisFunnelModel.init, [loading.dataAnalysisFunnelModel.init])

  useEffect(() => {
    if (!timeRange || !attributionModel) {
      refresh({
        timeRange: timeRange || [dayjs().subtract(7, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
        attributionModel: attributionModel || AttributionModelEnum.FIRST_TOUCH,
      }, true)
    }
  }, [timeRange, attributionModel])

  useEffect(() => {
    dispatch.dataAnalysisEventModel.init()
  }, [dispatch.dataAnalysisEventModel])

  return (
    <Spin spinning={pageLoading}>
      <div className={styles.container}>
        <DataAnalysisHeader
          title="归因分析"
          updateTime={updateTime}
        />
        <DataFilterConfigArea />
        <div className={styles.hr} />
        <DataTable />
      </div>
    </Spin>
  )
}

export default AttributionAnalysis
