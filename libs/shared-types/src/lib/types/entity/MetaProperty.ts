import { IEventPropertyRelation } from "./EventPropertyRelation"

export interface IMetaProperty {
  propertyName?: string
  propertyType?: MetaPropertyType
  type?: MetaPropertyBusinessType
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
  // 对应 ClickHouse String
  STRING = 'string',
  // 对应 ClickHouse Int64
  NUMBER = 'number',
  // 对应 ClickHouse Float64
  FLOAT = 'float',
  // 对应 ClickHouse UInt8，0-false 1-true
  BOOLEAN = 'boolean',
  // 对应 ClickHouse Date64(3)，精确到毫秒
  DATE = 'date',
}

/**
 * 业务中的原属性类型与 ClickHouse 类型映射
 */
export const MetaPropertyTypeMap = {
  [MetaPropertyType.STRING]: 'String',
  [MetaPropertyType.NUMBER]: 'Int64',
  [MetaPropertyType.FLOAT]: 'Float64',
  [MetaPropertyType.BOOLEAN]: 'UInt8',
  [MetaPropertyType.DATE]: 'Date64(3)',
}

/**
 * 元属性状态枚举
 */
export enum MetaPropertyStatus {
  // 有效
  VALID = 1,
}

/**
 * 元属性业务类型
 */
export enum MetaPropertyBusinessType {
  // 公共属性
  COMMON = 1,
  // 业务属性
  BUSINESS = 2,
}
