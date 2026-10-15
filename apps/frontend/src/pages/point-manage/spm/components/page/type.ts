import { ITrackingSpmListItem } from "@pages/point-manage/spm/type"

export interface IPageProps {
  selectedPage: ITrackingSpmListItem
  selectPage: (page: ITrackingSpmListItem) => void
  openPageAdd: () => void
  openPageEdit: (page: ITrackingSpmListItem) => void
}
