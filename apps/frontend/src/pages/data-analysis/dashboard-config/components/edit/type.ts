import { IDashboard, ICreateDashboardReq, IUpdateDashboardReq } from "../../type"

export interface IDashboardEditPopupProps {
  dashboard?: IDashboard
  open: boolean
  onClose: () => void
  onSubmit: () => Promise<void>
}
