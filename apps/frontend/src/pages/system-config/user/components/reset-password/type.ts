import { IUserListItem, IResetPasswordReq } from "../../type"

export interface IResetPasswordPopupProps {
  user?: IUserListItem
  open: boolean
  onClose: () => void
  onSubmit: (data: IResetPasswordReq) => Promise<void>
}

