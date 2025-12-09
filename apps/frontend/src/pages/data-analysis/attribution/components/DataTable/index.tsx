import React, { memo } from "react"
import { useModel, useQuery } from "@/hooks"
import { IDataAnalysisAttributionState, IQuery } from "@pages/data-analysis/attribution/type"
import * as styles from "./styles.module.scss"

function DataTable() {

  const {
    timeRange,
    dimension = [],
  } = useQuery<IQuery>()

  const {
    data,
  } = useModel<IDataAnalysisAttributionState>('dataAnalysisAttributionModel')

  return (
    <div className={styles.container}>
      <h3>表格展示</h3>
    </div>
  )
}

export default memo(DataTable)
