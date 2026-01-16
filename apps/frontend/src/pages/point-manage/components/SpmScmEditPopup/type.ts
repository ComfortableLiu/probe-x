import { IAnyObj, ITrackingListItem, TrackingNodeLevel } from "@probe-x/shared-types/src"

export interface ISpmScmEditPopupProps {
  open: boolean
  // 当前节点名称
  nodeName?: string
  // 当前节点数据
  selectedNodeData?: ITrackingListItem
  // 所属父节点名称
  parentNodeName?: string
  // 所属父节点
  parentNode?: ITrackingListItem
  // 节点层级（用于新增时指定）
  level?: TrackingNodeLevel
  loading?: boolean
  onClose: () => void
  onSubmit: (data: IAnyObj) => Promise<void>
}