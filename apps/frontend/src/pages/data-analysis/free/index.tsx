import React, { useCallback, useEffect, useMemo, useState } from "react"
import DataFilterConfigArea from "./components/DataFilterConfigArea"
import DataChart from "./components/DataChart"
import DataTable from "./components/DataTable"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import * as styles from "./styles.module.scss"
import { message, Spin } from "antd"
import { useLoading, useModel, useQuery, useRouter } from "@/hooks"
import { IDataAnalysisFreeState, IQuery } from "./type"
import dayjs from "dayjs"
import DataAnalysisHeader from "@pages/data-analysis/components/DataAnalysisHeader"
import SaveAsDashboardPopup from "@pages/data-analysis/components/SaveAsDashboardPopup"
import { AnalysisType } from "@pages/data-analysis/dashboard-config/type"

function FreeAnalysis() {

  const dispatch = useDispatch<Dispatch>()

  const {
    updateTime,
  } = useModel<IDataAnalysisFreeState>('dataAnalysisFreeModel')

  const {
    timeRange,
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  // 显示保存为看板弹窗
  const [showSaveAsDashboardPopup, setShowSaveAsDashboardPopup] = useState(false)

  useEffect(() => {
    if (!timeRange) {
      refresh({
        timeRange: [dayjs().subtract(7, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
      }, true)
    }
  }, [timeRange])

  useEffect(() => {
    dispatch.dataAnalysisFreeModel.init()
  }, [dispatch.dataAnalysisFreeModel])

  const loading = useLoading()

  const pageLoading = useMemo(() => loading.dataAnalysisFreeModel.init, [loading.dataAnalysisFreeModel.init])

  const handleSaveAsDashboard = useCallback(() => {
    // 先检查填写项
    dispatch.dataAnalysisFreeModel.checkQueryParams().then((flag) => {
      if (flag) {
        message.error(flag)
        return
      }
      setShowSaveAsDashboardPopup(true)
    })
  }, [dispatch.dataAnalysisFreeModel])

  return (
    <Spin spinning={pageLoading}>
      <div className={styles.container}>
        <DataAnalysisHeader
          title="自由分析"
          updateTime={updateTime}
          onSaveAsDashboard={handleSaveAsDashboard}
          guidePath="/guide/data-analysis/free"
        />
        <DataFilterConfigArea />
        <div className={styles.hr} />
        <DataChart />
        <div className={styles.hr} />
        <DataTable />
        <SaveAsDashboardPopup
          analysisType={AnalysisType.FREE}
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

export default FreeAnalysis
