import { IEventListItem } from "@pages/point-manage/event/type"

export interface IEventDetailProps {
  event?: IEventListItem
  onClose?: () => void
}
