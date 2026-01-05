import { IFormItemProps } from "../../type"
import type { UploadListType } from "antd/es/upload"

export interface IFormUploadProps extends IFormItemProps<string | string[] | undefined> {
  action?: string
  accept?: string
  maxCount?: number
  listType?: UploadListType
}

