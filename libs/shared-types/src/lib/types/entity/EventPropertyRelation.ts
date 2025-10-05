import { IMetaEvent } from "./MetaEvent"
import { IMetaProperty } from "./MetaProperty"

export interface IEventPropertyRelation {
  id?: number
  eventPropertyRemark?: string
  createTime?: Date
  createUserId?: number
  updateTime?: Date
  updateUserId?: number
  status?: EventPropertyRelationStatus

  // 关联的实体
  metaEvent?: IMetaEvent
  metaProperty?: IMetaProperty

  // 为了方便访问关联实体的主键
  eventName?: string
  propertyName?: string
}

export enum EventPropertyRelationStatus {
  // 有效
  VALID = 1,
}
