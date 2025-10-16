import { IPropertyListItem } from "@pages/point-manage/property/type"

export interface IPropertyEditPopupProps {
  property?: IPropertyListItem
  open: boolean
  onClose: () => void
  onSubmit: (property: IPropertyListItem) => Promise<void>
}
