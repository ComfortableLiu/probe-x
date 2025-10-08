// 分页接口返回值
export interface IPageResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// 分页接口请求
export interface IPageQuery {
  page: number
  pageSize: number
}
