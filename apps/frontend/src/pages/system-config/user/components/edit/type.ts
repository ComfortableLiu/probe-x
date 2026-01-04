import { IUserListItem, ICreateUserReq, IUpdateUserReq } from "../../type"

export interface IUserEditPopupProps {
  user?: IUserListItem
  open: boolean
  onClose: () => void
  onSubmit: (data: ICreateUserReq | IUpdateUserReq) => Promise<void>
}

