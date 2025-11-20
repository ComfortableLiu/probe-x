import React, { useEffect, useMemo, useState } from "react"
import DataFilterConfigArea from "./components/DataFilterConfigArea"
import * as styles from "./styles.module.scss"
import { Spin } from "antd"
import { useLoading, useModel, useQuery, useRouter } from "@/hooks"
import DownloadPopup from "@pages/data-analysis/components/DownloadPopup"
import DataAnalysisHeader from "@pages/data-analysis/components/DataAnalysisHeader"
import { IDataAnalysisFunnelState, IQuery } from "@pages/data-analysis/funnel/type"
import dayjs from "dayjs"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { FunnelTypeEnum } from "@probe-x/shared-types/src"

function FunnelAnalysis() {

  const dispatch = useDispatch<Dispatch>()

  const {
    updateTime,
  } = useModel<IDataAnalysisFunnelState>('dataAnalysisFunnelModel')

  const {
    timeRange,
    windowPeriod,
    funnelType,
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  const loading = useLoading()

  const pageLoading = useMemo(() => loading.dataAnalysisFunnelModel.init, [loading.dataAnalysisFunnelModel.init])

  // 显示下载弹窗
  const [showDownloadPopup, setShowDownloadPopup] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

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

  return (
    <Spin spinning={pageLoading}>
      <div className={styles.container}>
        <DataAnalysisHeader
          title="漏斗分析"
          updateTime={updateTime}
        />
        <DataFilterConfigArea />
        <div className={styles.hr} />

        <DownloadPopup
          downloadUrl={downloadUrl}
          onClose={() => setShowDownloadPopup(false)}
          show={showDownloadPopup}
        />
      </div>
    </Spin>
  )
}

export default FunnelAnalysis
