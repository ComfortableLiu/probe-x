import { ITrackingSpmListItem } from "@pages/point-manage/spm/type"

export interface IPointProps {
  selectedPage?: ITrackingSpmListItem
  selectedModule?: ITrackingSpmListItem
  selectedPoint?: ITrackingSpmListItem
  openPointAdd: (module: ITrackingSpmListItem) => void
  openPointEdit: (point: ITrackingSpmListItem, module: ITrackingSpmListItem) => void
  openModuleEdit: (module: ITrackingSpmListItem, page: ITrackingSpmListItem) => void
  selectPoint: (module: ITrackingSpmListItem) => void
}
