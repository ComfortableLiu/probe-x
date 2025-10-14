import { ITrackingSpmListItem } from "@pages/point-manage/spm/type"

export interface IPageProps {
  containerHeight: number
  selectedPage: ITrackingSpmListItem
  selectPage: (page: ITrackingSpmListItem) => void
  openPageAdd: () => void
  openPageEdit: (page: ITrackingSpmListItem) => void
}