import { ISystemListItem } from "../../type"

export interface ISystemEditPopupProps {
  system: ISystemListItem | null
  open: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<void>
}
