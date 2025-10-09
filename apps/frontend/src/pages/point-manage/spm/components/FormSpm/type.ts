import { IFormItemProps } from "@components/FormComponent/type"

export interface ISpmInfo {
  a: string
  b: string
  c: string
  d: string
}

export interface IFormSpmProps extends IFormItemProps<ISpmInfo> {
}