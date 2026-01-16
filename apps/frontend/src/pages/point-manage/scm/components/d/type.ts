import { ITrackingScmListItem } from "@pages/point-manage/scm/type"

export interface IDProps {
  containerHeight: number
  selectedA?: ITrackingScmListItem
  selectedB?: ITrackingScmListItem
  selectedC?: ITrackingScmListItem
  selectedD?: ITrackingScmListItem
  selectD: (d: ITrackingScmListItem) => void
  openDAdd: (c: ITrackingScmListItem) => void
  openDEdit: (d: ITrackingScmListItem, c: ITrackingScmListItem) => void
  openCEdit: (c: ITrackingScmListItem, b: ITrackingScmListItem) => void
}
