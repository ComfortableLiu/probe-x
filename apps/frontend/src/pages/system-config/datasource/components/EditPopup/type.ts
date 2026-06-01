import { IDataSourceListItem, ICreateDataSourceReq, IUpdateDataSourceReq } from "../../type"

export interface IDataSourceEditPopupProps {
  record?: IDataSourceListItem
  open: boolean
  onClose: () => void
  onSubmit: (data: ICreateDataSourceReq | IUpdateDataSourceReq) => Promise<void>
}
