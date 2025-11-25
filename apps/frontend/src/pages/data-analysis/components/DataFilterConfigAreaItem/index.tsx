import React, { memo, ReactNode } from "react"
import * as styles from "./styles.module.scss"

interface IDataFilterConfigAreaItemProps {
  title: string
  content: ReactNode
}

function DataFilterConfigAreaItem(props: IDataFilterConfigAreaItemProps) {
  const {
    title,
    content,
  } = props

  return (
    <div className={styles.selectorContainer}>
      <div className={styles.title}>{title}</div>
      <div className={styles.content}>
        {content}
      </div>
    </div>
  )
}

export default memo(DataFilterConfigAreaItem)
