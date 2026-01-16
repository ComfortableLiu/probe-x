import { ITrackingScmListItem } from "@pages/point-manage/scm/type"

export interface IAProps {
  containerHeight: number
  selectedA: ITrackingScmListItem
  selectA: (a: ITrackingScmListItem) => void
  openAAdd: () => void
  openAEdit: (a: ITrackingScmListItem) => void
}
