import React, { memo } from "react"
import { IFunnelInfo } from "@probe-x/shared-types/src"
import * as styles from "./styles.module.scss"
import { CopyOne, Delete } from "@icon-park/react"

interface IFunnelItemProps {
  funnelInfo: IFunnelInfo | null
  index: number
  // 点击移除
  onRemove: () => void
  // 点击复制
  onCopy: () => void
  // 点击编辑
  onEdit: (funnelInfo: IFunnelInfo) => void
}

function FunnelItem(props: IFunnelItemProps) {

  const {
    funnelInfo,
    index,
    onCopy,
    onRemove,
    onEdit,
  } = props

  if (!funnelInfo) return null

  return (
    <div className={styles.container}>
      <div className={styles.tag}>
        {index + 1}
      </div>

      <div className={styles.content} onClick={() => onEdit(funnelInfo)}>
        {funnelInfo.stepName || funnelInfo.eventInfo.eventName}
      </div>

      <div className={styles.operate}>
        <a href="#" className={styles.operateBtn} onClick={() => onCopy?.()}>
          <CopyOne className={styles.icon} theme="outline" size="14" fill="#333" />
          复制
        </a>
        <a href="#" className={styles.operateBtn} onClick={() => onRemove?.()}>
          <Delete className={styles.icon} theme="outline" size="14" fill="#333" />
          移除
        </a>
      </div>
    </div>
  )
}

export default memo(FunnelItem)
