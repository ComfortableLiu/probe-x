import { IRoleListItem, IAssignPermissionsReq } from "../../type"

export interface IAssignPermissionsPopupProps {
  role?: IRoleListItem
  open: boolean
  onClose: () => void
  onSubmit: (data: IAssignPermissionsReq) => Promise<void>
}

