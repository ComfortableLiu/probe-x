import { MetaPropertyType } from "../../entity"

// 属性过滤条件
export interface IAttributionAnalysisFilter {
  // 属性名
  propertyName: string
  // 属性类型
  propertyType: MetaPropertyType
  // 属性值
  propertyValue: string | number | string[] | number[]
  // 比较方式
  compareType: CompareType
}

// 筛选条件类型的文字
export const CompareText = {
  EQUAL: '等于',
  NOT_EQUAL: '不等于',
  GREATER_THAN: '大于',
  GREATER_THAN_OR_EQUAL: '大于等于',
  LESS_THAN: '小于',
  LESS_THAN_OR_EQUAL: '小于等于',
  RANGE: '区间',
  CONTAINS: '包含',
  NOT_CONTAINS: '不包含',
  REGEX: '匹配正则',
}

// 筛选条件类型
export type CompareType = keyof typeof CompareText
