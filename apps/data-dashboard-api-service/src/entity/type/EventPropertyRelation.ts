import { IMetaEvent } from "@entity/type/MetaEvent"
import { IMetaProperty } from "@entity/type/MetaProperty"

export interface IEventPropertyRelation {
  id?: number
  eventPropertyRemark?: string
  creatTime?: Date
  creatUserId?: number
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