import { INotificationListItem, ICreateNotificationReq, IUpdateNotificationReq } from "../../type"

export interface INotificationEditPopupProps {
  record?: INotificationListItem
  open: boolean
  onClose: () => void
  onSubmit: (data: ICreateNotificationReq | IUpdateNotificationReq) => Promise<void>
}
