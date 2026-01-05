import { IFormItemProps } from "../../type"

export interface IFormNumberProps extends IFormItemProps<number | undefined> {
  min?: number
  max?: number
  step?: number
  precision?: number
}

