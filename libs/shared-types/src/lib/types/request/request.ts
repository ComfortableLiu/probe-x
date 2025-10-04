// 分页接口返回值
export interface IPageResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
