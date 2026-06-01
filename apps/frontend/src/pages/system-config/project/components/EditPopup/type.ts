import { IProjectListItem, ICreateProjectReq, IUpdateProjectReq } from "../../type"

export interface IProjectEditPopupProps {
  record?: IProjectListItem
  open: boolean
  onClose: () => void
  onSubmit: (data: ICreateProjectReq | IUpdateProjectReq) => Promise<void>
}
