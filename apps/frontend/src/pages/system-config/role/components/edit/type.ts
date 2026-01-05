import { IRoleListItem, ICreateRoleReq, IUpdateRoleReq } from "../../type"

export interface IRoleEditPopupProps {
  role?: IRoleListItem
  open: boolean
  onClose: () => void
  onSubmit: (data: ICreateRoleReq | IUpdateRoleReq) => Promise<void>
}

