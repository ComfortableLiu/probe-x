import { IPropertyListItem } from "@pages/point-manage/property/type"

export interface IPropertyDetailProps {
  property?: IPropertyListItem
  onClose?: () => void
}
