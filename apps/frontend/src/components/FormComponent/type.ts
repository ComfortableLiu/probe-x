import { FormItemType } from "./constants"
import { ComponentType, type CSSProperties } from "react"
import type { LabelTooltipType } from "antd/es/form/FormItemLabel"
import { IFormTextProps } from "@components/FormComponent/form-item/text/type"
import { IFormSelectProps, IFormSelectOption } from "@components/FormComponent/form-item/select/type"
import { IFormCheckboxProps } from "@components/FormComponent/form-item/checkbox/type"
import { IFormCascaderProps, IFormCascaderOption } from "@components/FormComponent/form-item/cascader/type"
import { IFormDateProps } from "@components/FormComponent/form-item/date/type"
import { IFormDateTimeProps } from "@components/FormComponent/form-item/date-time/type"
import { IFormTimeProps } from "@components/FormComponent/form-item/time/type"
import { IFormRadioProps, IFormRadioOption } from "@components/FormComponent/form-item/radio/type"
import { IFormSwitchProps } from "@components/FormComponent/form-item/switch/type"
import { IFormUploadProps } from "@components/FormComponent/form-item/upload/type"
import { IFormNumberProps } from "@components/FormComponent/form-item/number/type"
import { IFormRateProps } from "@components/FormComponent/form-item/rate/type"
import { IFormSliderProps } from "@components/FormComponent/form-item/slider/type"
import type { SliderMarks } from "antd/es/slider"

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
  // 选项列表（用于 SELECT、RADIO、CASCADER 等组件）
  options?: IFormSelectOption[] | IFormRadioOption[] | IFormCascaderOption[]
  // 其他特定组件的属性
  min?: number
  max?: number
  step?: number
  precision?: number
  multiple?: boolean
  allowClear?: boolean
  allowHalf?: boolean
  count?: number
  marks?: SliderMarks
  action?: string
  accept?: string
  maxCount?: number
  listType?: 'text' | 'picture' | 'picture-card'
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

export type FormItem = IFormTextProps & IFormSelectProps & IFormCascaderProps & IFormCheckboxProps & IFormDateProps & IFormDateTimeProps & IFormTimeProps & IFormRadioProps & IFormSwitchProps & IFormUploadProps & IFormNumberProps & IFormRateProps & IFormSliderProps