import { IFormItemProps } from "../../type"

export type SelectValue = string | number | boolean | null | undefined
export type SelectValueArray = (string | number | boolean)[]

export interface IFormSelectProps extends IFormItemProps<SelectValue | SelectValueArray> {
  options: IFormSelectOption[];
  multiple?: boolean;
  allowClear?: boolean;
}

export interface IFormSelectOption {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
}

