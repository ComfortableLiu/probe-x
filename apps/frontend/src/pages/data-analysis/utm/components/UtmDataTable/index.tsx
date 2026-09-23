import React, { memo, useMemo } from "react"
import { TableProps, Tooltip } from "antd"
import TableComponent from "@components/TableComponent"
import { useModel } from "@/hooks"
import {
  IUtmAnalysisRow,
  UTM_DIMENSION_LABEL,
  utmDimAlias,
  utmMetricTotalAlias,
} from "@probe-x/shared-types/src"
import { IDataAnalysisUtmState, METRIC_LABEL } from "@pages/data-analysis/utm/type"
import { buildUtmAliasMap, getUtmAlias } from "@pages/data-analysis/utm/utils"
import * as styles from "./styles.module.scss"

// 合计行用固定 key 标记。IUtmAnalysisRow 的索引签名只允许标量，
// 挂不了 boolean 标志位，所以拿 key 当判别条件
const SUMMARY_KEY = 'summary'

type IRow = IUtmAnalysisRow & { key: string }

/**
 * UTM 分析汇总表
 *
 * 列 = 选中的 UTM 维度 + 各指标的区间合计。
 * 合计行单独给（来自 summary），用户数/会话数是 uniq 口径，不能由分组行相加得出
 */
function UtmDataTable() {

  const {
    data,
    querySnapshot,
    utmOptions,
  } = useModel<IDataAnalysisUtmState>('dataAnalysisUtmModel')

  const aliasMap = useMemo(() => buildUtmAliasMap(utmOptions), [utmOptions])

  const dimensions = useMemo(() => querySnapshot?.dimensions || [], [querySnapshot])
  const metrics = useMemo(() => querySnapshot?.metrics || [], [querySnapshot])

  const dataSource = useMemo<IRow[]>(() => {
    const rows: IRow[] = (data?.rows || []).map((row, index) => ({ ...row, key: `row_${index}` }))
    const summary = data?.summary
    if (summary && Object.keys(summary).length) {
      const summaryRow: IRow = { ...summary, key: SUMMARY_KEY }
      return [summaryRow, ...rows]
    }
    return rows
  }, [data])

  const columns = useMemo<TableProps<IRow>['columns']>(() => {
    const dimColumns = dimensions.map((dimension, index) => ({
      title: UTM_DIMENSION_LABEL[dimension] || dimension,
      dataIndex: utmDimAlias(dimension),
      width: 220,
      render: (value: string, record: IRow) => {
        // 合计行不按维度拆分，标签落在第一个维度列上
        if (record.key === SUMMARY_KEY) {
          return index === 0 ? <span className={styles.summaryLabel}>合计</span> : null
        }
        const alias = getUtmAlias(dimension, value, aliasMap)
        return (
          <Tooltip title={alias || undefined}>
            <span className={styles.valueCell}>{value ?? '-'}</span>
          </Tooltip>
        )
      },
    }))

    const metricColumns = metrics.map((metric) => ({
      title: METRIC_LABEL[metric] || metric,
      dataIndex: utmMetricTotalAlias(metric),
      width: 130,
      render: (value: number) => (Number(value) || 0).toLocaleString(),
    }))

    return [...dimColumns, ...metricColumns]
  }, [dimensions, metrics, aliasMap])

  return (
    <TableComponent<IRow>
      dataSource={dataSource}
      columns={columns}
    />
  )
}

export default memo(UtmDataTable)
