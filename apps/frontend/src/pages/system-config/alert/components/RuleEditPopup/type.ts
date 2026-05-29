import { IAlertRuleListItem, ICreateAlertRuleReq, IUpdateAlertRuleReq } from "../../type"

export interface IRuleEditPopupProps {
  record?: IAlertRuleListItem
  open: boolean
  onClose: () => void
  onSubmit: (data: ICreateAlertRuleReq | IUpdateAlertRuleReq) => Promise<void>
}
