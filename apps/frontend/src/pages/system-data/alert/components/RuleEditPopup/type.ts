import { IAlertRule, ICreateAlertRuleReq, IUpdateAlertRuleReq } from "../../type"

export interface IRuleEditPopupProps {
  record?: IAlertRule
  open: boolean
  onClose: () => void
  onSubmit: (data: ICreateAlertRuleReq | IUpdateAlertRuleReq) => Promise<void>
}
