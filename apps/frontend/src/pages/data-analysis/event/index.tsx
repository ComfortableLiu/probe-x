import React, { useCallback, useEffect } from "react"
import EventSelector from "./components/EventSelector"
import DataChat from "./components/DataChat"
import DataTable from "./components/DataTable"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import * as styles from "./styles.module.scss"
import { Button } from "antd"
import { Download } from "@icon-park/react"
import { useRouter } from "@/hooks"
import { ChartType, IQuery, Metrics } from "@pages/data-analysis/event/type"

function EventAnalysis() {

  const dispatch = useDispatch<Dispatch>()
  const {
    refresh,
  } = useRouter()

  useEffect(() => {
    // dispatch.pointModel.getEventList()
  }, [dispatch.pointModel])

  const download = useCallback(() => {
    const q: IQuery = {
      timeRange: [new Date('2025-11-03'), new Date('2025-11-09')],
      dimension: [{
        propertyKey: 'aa',
        propertyName: '页面',
      }, {
        propertyKey: 'bb',
        propertyName: '延时',
      }],
      eventInfoList: [{
        eventName: 'goods-exposure',
        metrics: Metrics.COUNT,
      }, {
        eventName: 'goods-click',
        metrics: Metrics.SESSIONS,
      }, {
        eventName: 'goods-favor',
        metrics: Metrics.USERS,
      }],
      chartType: ChartType.LINE,
    }
    console.log(q)
    refresh(q)
  }, [refresh])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>事件分析</div>
        <div>更新时间：2023-07-07 16:07:07</div>
        <Button
          type="link"
          onClick={() => download()}
        >
          <Download theme="filled" size="16" fill="#333" />
          下载
        </Button>
      </div>
      <EventSelector />
      <DataChat />
      <DataTable />
    </div>
  )
}

export default EventAnalysis
