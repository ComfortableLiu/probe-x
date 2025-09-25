import { FormItemType } from "./constants"
import { type CSSProperties, ReactNode } from "react"

export interface IFormComponentProps<T> {
  // 表单元素列表
  formItems: IFormItem[]
  onFinish?: (values: T) => void
}

export interface IFormItem {
  // 表单类型
  type: FormItemType
  // 表单key，同时是url上面的key
  key: string
  // 表单label
  label: string
  // 自定义组件
  customComponent?: ReactNode
  disabled?: boolean
  placeholder?: string
  style?: CSSProperties
}

/**
 * 表单项公共属性
 */
export interface IFormItemProps<T> {
  key?: string
  value?: T
  onChange?: (value: T) => void
  disabled?: boolean
  placeholder?: string
  style?: CSSProperties
}