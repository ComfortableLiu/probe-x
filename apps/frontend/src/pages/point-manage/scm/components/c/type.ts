import { ITrackingScmListItem } from "@pages/point-manage/scm/type"

export interface ICProps {
  containerHeight: number
  selectedA?: ITrackingScmListItem
  selectedB?: ITrackingScmListItem
  selectedC?: ITrackingScmListItem
  selectC: (c: ITrackingScmListItem) => void
  openCAdd: (b: ITrackingScmListItem) => void
  openCEdit: (c: ITrackingScmListItem, b: ITrackingScmListItem) => void
  openBEdit: (b: ITrackingScmListItem, a: ITrackingScmListItem) => void
}
