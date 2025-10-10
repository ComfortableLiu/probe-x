import { FormItemType } from "./constants"
import { ComponentType, type CSSProperties } from "react"
import type { LabelTooltipType } from "antd/es/form/FormItemLabel"
import { IFormTextProps } from "@components/FormComponent/form-item/text/type"
import { IFormCheckboxProps } from "@components/FormComponent/form-item/checkbox/type"
import { IFormCascaderProps } from "@components/FormComponent/form-item/cascader/type"

export interface IFormComponentProps<T> {
  // 表单元素列表
  formItems: IFormItem[]
  onFinish?: (values: T) => void
}

export interface IFormItem extends Partial<FormItem>{
  // 表单类型
  type: FormItemType
  // 表单key，同时是url上面的key
  key: string
  // 表单label
  label: string
  // 自定义组件
  customComponent?: ComponentType<any>
  disabled?: boolean
  placeholder?: string
  style?: CSSProperties
  // 提示信息
  tooltip?: LabelTooltipType
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
  submit?: () => void
}

export type FormItem = IFormTextProps & IFormCascaderProps & IFormCheckboxProps