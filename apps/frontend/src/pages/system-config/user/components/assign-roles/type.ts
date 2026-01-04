import { IUserListItem, IAssignRolesReq } from "../../type"

export interface IAssignRolesPopupProps {
  user?: IUserListItem
  open: boolean
  onClose: () => void
  onSubmit: (data: IAssignRolesReq) => Promise<void>
}

