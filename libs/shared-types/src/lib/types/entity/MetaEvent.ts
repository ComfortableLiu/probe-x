import { IEventPropertyRelation } from "./EventPropertyRelation"

export interface IMetaEvent {
  eventName: string
  eventAliases: string
  eventRemark: string
  createTime: Date
  createUserId: number
  updateUserId: number
  updateTime: Date
  status: MetaEventStatus

  // 当前事件包含的属性关联列表
  eventPropertyRelations?: IEventPropertyRelation[]
}

/**
 * 元事件状态枚举
 */
export enum MetaEventStatus {
  // 有效
  VALID = 1,
  // 停止接收
  STOP = 2,
  // 禁用
  DISABLE = 3,
  // 删除
  DELETE = 4,
}
