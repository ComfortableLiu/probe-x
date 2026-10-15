import { ITrackingScmListItem } from "@pages/point-manage/scm/type"

export interface IAProps {
  selectedA: ITrackingScmListItem
  selectA: (a: ITrackingScmListItem) => void
  openAAdd: () => void
  openAEdit: (a: ITrackingScmListItem) => void
}
