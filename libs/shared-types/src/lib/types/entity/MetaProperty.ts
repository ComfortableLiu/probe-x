import { IEventPropertyRelation } from "./EventPropertyRelation"

export interface IMetaProperty {
  propertyName?: string
  propertyType?: MetaPropertyType
  createTime?: Date
  createUserId?: number
  updateTime?: Date
  updateUserId?: number
  status?: MetaPropertyStatus

  // 当前属性关联的事件列表
  eventPropertyRelations?: IEventPropertyRelation[]
}

/**
 * 元属性类型枚举
 */
export enum MetaPropertyType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
}

/**
 * 元属性状态枚举
 */
export enum MetaPropertyStatus {
  // 有效
  VALID = 1,
}
