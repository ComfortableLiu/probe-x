import { TableProps } from "antd"

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
}
