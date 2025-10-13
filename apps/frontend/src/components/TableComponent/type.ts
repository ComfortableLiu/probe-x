import { TablePaginationConfig, TableProps } from "antd"
import { CSSProperties } from "react"
import type { ExpandableConfig } from "rc-table/lib/interface"

export interface ITableComponentProps<DataType> {
  dataSource: DataType[]
  columns: TableProps<DataType>['columns']
  paginationData?: {
    // 总数
    total: number
    // 每页条数
    pageSize: number
    // 当前页码
    current: number
  }

  // 是否开启虚拟列表
  virtual?: boolean

  loading?: boolean

  style?: CSSProperties

  // 分页改变回调，如果传了，就不会去修改url参数，不传就去修改url参数
  onPaginationChange?: (pagination: TablePaginationConfig) => void

  // 展开配置
  expandable?: ExpandableConfig<DataType>
}
