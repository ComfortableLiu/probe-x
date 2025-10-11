import { IBusinessListItem } from "@probe-x/shared-types/src"

export interface IEditBusinessSiteProps {
  open: boolean
  businessSiteInfo?: IBusinessListItem
  onClose: () => void
}