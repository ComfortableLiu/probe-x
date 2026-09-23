import React, { useCallback, useMemo } from "react"
import * as styles from "./styles.module.scss"
import { Alert, Button, Table, Typography } from "antd"
import { useLoading, useModel } from "@/hooks"
import DataAnalysisHeader from "@pages/data-analysis/components/DataAnalysisHeader"
import { IDataAnalysisSqlState } from "@pages/data-analysis/sql/type"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import SqlEditor from "./components/SqlEditor"

function SqlAnalysis() {

  const dispatch = useDispatch<Dispatch>()

  const {
    sql,
    data,
    duration,
    error,
    updateTime,
  } = useModel<IDataAnalysisSqlState>('dataAnalysisSqlModel')

  const loading = useLoading()

  const queryLoading = useMemo(() => loading.dataAnalysisSqlModel.submitQuery, [loading.dataAnalysisSqlModel.submitQuery])

  const handleSqlChange = useCallback((value: string) => {
    dispatch.dataAnalysisSqlModel.updateItem({ sql: value })
  }, [dispatch.dataAnalysisSqlModel])

  const handleExecute = useCallback(() => {
    dispatch.dataAnalysisSqlModel.submitQuery({ sql: sql || '' })
  }, [dispatch.dataAnalysisSqlModel, sql])

  const tableColumns = useMemo(() => (data?.columns || []).map(col => ({
    title: (
      <div className={styles.columnTitle}>
        <div>{col.name}</div>
        <div className={styles.columnType}>{col.type}</div>
      </div>
    ),
    dataIndex: col.name,
    key: col.name,
    render: (value: any) => {
      if (value === null || value === undefined) return '-'
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    },
  })), [data?.columns])

  return (
    <div className={styles.container}>
      <DataAnalysisHeader
        title="SQL 查询"
        updateTime={updateTime}
      />
      <div className={styles.editorSection}>
        <SqlEditor
          value={sql || ''}
          onChange={handleSqlChange}
          onExecute={handleExecute}
        />
        <div className={styles.editorFooter}>
          <Typography.Text type="secondary">
            示例：SELECT * FROM `$final_event_log` LIMIT 100（$ 开头的列名需用反引号包裹），支持 Cmd/Ctrl + Enter 快捷执行
          </Typography.Text>
          <Button
            type="primary"
            loading={queryLoading}
            onClick={handleExecute}
          >
            执行
          </Button>
        </div>
      </div>
      {error && (
        <Alert
          type="error"
          showIcon
          message="查询失败"
          description={error}
        />
      )}
      {data && !error && (
        <div className={styles.resultSection}>
          <Typography.Text type="secondary">
            返回 {data.rowCount} 行{typeof duration === 'number' ? `，耗时 ${duration}ms` : ''}
          </Typography.Text>
          <Table
            size="small"
            columns={tableColumns}
            dataSource={data.rows}
            rowKey={(_, index) => String(index)}
            scroll={{ x: 'max-content' }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条`,
            }}
          />
        </div>
      )}
    </div>
  )
}

export default SqlAnalysis
