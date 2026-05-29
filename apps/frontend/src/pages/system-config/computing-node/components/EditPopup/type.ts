import { IComputeNodeListItem, ICreateComputeNodeReq, IUpdateComputeNodeReq } from "../../type"

export interface IComputeNodeEditPopupProps {
  record?: IComputeNodeListItem
  open: boolean
  onClose: () => void
  onSubmit: (data: ICreateComputeNodeReq | IUpdateComputeNodeReq) => Promise<void>
}
