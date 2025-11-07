import React, { useEffect } from "react"
import EventSelector from "./components/EventSelector"
import DataChat from "./components/DataChat"
import DataTable from "./components/DataTable"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import * as styles from "./styles.module.scss"
import { Button } from "antd"
import { Download } from "@icon-park/react"

function EventAnalysis() {

  const dispatch = useDispatch<Dispatch>()

  useEffect(() => {
    // dispatch.pointModel.getEventList()
  }, [dispatch.pointModel])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>事件分析</div>
        <div>更新时间：2023-07-07 16:07:07</div>
        <Button
          type="link"
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
