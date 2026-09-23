import { IUtmItem, IUpdateUtmReq } from "@probe-x/shared-types/src"

export interface IEditPopupProps {
  record?: IUtmItem
  open: boolean
  onClose: () => void
  onSubmit: (data: IUpdateUtmReq & { isDeleted?: boolean }) => Promise<void>
}
