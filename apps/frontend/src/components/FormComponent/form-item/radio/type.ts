import { IFormItemProps } from "../../type"

export interface IFormRadioProps extends IFormItemProps<string | number> {
  options: IFormRadioOption[];
}

export interface IFormRadioOption {
  value: string | number;
  label: string;
}

