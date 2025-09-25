import React, { memo, useMemo } from "react"
import { ITableComponentProps } from "@components/TableComponent/type"
import { Table, TablePaginationConfig } from "antd"
import * as styles from "./styles.module.scss"

function TableComponent<DataType>(props: ITableComponentProps<DataType>) {

  const {
    dataSource,
    columns,
    virtual,
    paginationData,
  } = props

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
    <div className={styles.tableGroup}>
      <Table<DataType>
        dataSource={dataSource}
        columns={columns}
        virtual={virtual}
        pagination={pagination}
      />
    </div>
  )
}

export default memo(TableComponent)