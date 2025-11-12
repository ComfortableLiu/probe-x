import React, { useCallback, useEffect } from "react"
import DataFilterConfigArea from "./components/DataFilterConfigArea"
import DataChat from "./components/DataChat"
import DataTable from "./components/DataTable"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import * as styles from "./styles.module.scss"
import { Button } from "antd"
import { Download } from "@icon-park/react"
import { useRouter } from "@/hooks"

function EventAnalysis() {

  const dispatch = useDispatch<Dispatch>()
  const {
    refresh,
  } = useRouter()

  useEffect(() => {
    dispatch.pointModel.getEventList()
    dispatch.pointModel.getPropertyList()
  }, [dispatch.pointModel])

  const download = useCallback(() => {
    console.log('download')
  }, [])

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
      <DataFilterConfigArea />
      <div className={styles.hr} />
      <DataChat />
      <div className={styles.hr} />
      <DataTable />
    </div>
  )
}

export default EventAnalysis
