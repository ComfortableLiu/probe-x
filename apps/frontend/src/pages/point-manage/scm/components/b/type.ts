import { ITrackingScmListItem } from "@pages/point-manage/scm/type"

export interface IBProps {
  selectedA?: ITrackingScmListItem
  selectedB?: ITrackingScmListItem
  selectB: (b: ITrackingScmListItem) => void
  openBAdd: (a: ITrackingScmListItem) => void
  openBEdit: (b: ITrackingScmListItem, a: ITrackingScmListItem) => void
  openAEdit: (a: ITrackingScmListItem) => void
}
