import { IFormItemProps } from "../../type"

export interface IFormRateProps extends IFormItemProps<number> {
  count?: number
  allowHalf?: boolean
}

