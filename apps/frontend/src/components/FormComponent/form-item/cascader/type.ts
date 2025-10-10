import { IFormItemProps } from "../../type"

export interface IFormCascaderProps extends IFormItemProps<string[]> {
  options: IFormCascaderOption[];
  multiple?: boolean;
}

export interface IFormCascaderOption {
  value: string;
  label: string;
  children?: IFormCascaderOption[];
}
