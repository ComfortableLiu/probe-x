// 数据源配置相关类型定义
import {
  IDataSourceListItem,
  IQueryDataSourceListReq,
  IQueryDataSourceListRes,
  ICreateDataSourceReq,
  IUpdateDataSourceReq,
  ITestDataSourceConnectionRes,
} from '@probe-x/shared-types/src'

export type {
  IDataSourceListItem,
  IQueryDataSourceListReq,
  IQueryDataSourceListRes,
  ICreateDataSourceReq,
  IUpdateDataSourceReq,
  ITestDataSourceConnectionRes,
}

export interface IDataSourceManageState {
  dataSourceList: IDataSourceListItem[]
  pagination: {
    total: number
    current: number
    pageSize: number
  }
  testResult?: ITestDataSourceConnectionRes
}
