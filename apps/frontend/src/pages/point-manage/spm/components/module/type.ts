import { ITrackingSpmListItem } from "@pages/point-manage/spm/type"

export interface IModuleProps {
  containerHeight: number
  selectedPage?: ITrackingSpmListItem
  selectedModule?: ITrackingSpmListItem
  selectModule: (module: ITrackingSpmListItem) => void
  openModuleAdd: (page: ITrackingSpmListItem) => void
  openModuleEdit: (module: ITrackingSpmListItem, page: ITrackingSpmListItem) => void
  openPageEdit: (page: ITrackingSpmListItem) => void
}