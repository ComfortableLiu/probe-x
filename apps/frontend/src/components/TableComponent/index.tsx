import React, { memo, useMemo } from "react"
import { ITableComponentProps } from "@components/TableComponent/type"
import { Table, TablePaginationConfig } from "antd"
import * as styles from "./styles.module.scss"
import { useRouter } from "@/hooks"

function TableComponent<DataType>(props: ITableComponentProps<DataType>) {

  const {
    dataSource,
    columns,
    virtual,
    paginationData,
    loading = false,
    style,
    onPaginationChange,
    expandable,
  } = props

  const { refresh } = useRouter()

  const pagination = useMemo<TablePaginationConfig | false>(() => {
    if (!paginationData) return false
    return {
      total: paginationData.total,
      current: paginationData.current,
      pageSize: paginationData.pageSize || 20,
      showSizeChanger: true,
      showQuickJumper: true,
      align: 'end',
    }
  }, [paginationData])

  return (
    <div className={styles.tableGroup} style={style}>
      <Table<DataType>
        dataSource={dataSource}
        columns={columns}
        virtual={virtual}
        pagination={pagination}
        loading={loading}
        scroll={{ x: "max-content" }}
        size="small"
        expandable={expandable}
        onChange={(pagination: TablePaginationConfig, filters, sorter, extra: {
          currentDataSource,
          // paginate | sort | filter
          action,
        }) => {
          if (extra.action === 'paginate') {
            if (onPaginationChange) {
              onPaginationChange(pagination)
            } else {
              refresh({
                page: pagination.current,
                pageSize: pagination.pageSize,
              }, true)
            }
          }
        }}
      />
    </div>
  )
}

export default memo(TableComponent) as <T>(props: ITableComponentProps<T>) => React.ReactElement
