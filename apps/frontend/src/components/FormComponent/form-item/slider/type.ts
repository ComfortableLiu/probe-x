import { IFormItemProps } from "../../type"
import type { SliderMarks } from "antd/es/slider"

export interface IFormSliderProps extends IFormItemProps<number> {
  min?: number
  max?: number
  step?: number
  marks?: SliderMarks
}

