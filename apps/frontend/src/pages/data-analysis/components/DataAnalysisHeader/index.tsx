import dayjs from "dayjs"
import { Button } from "antd"
import { Download } from "@icon-park/react"
import React, { memo, useMemo } from "react"
import * as styles from "./styles.module.scss"

interface IDataAnalysisHeaderProps {
  title: string
  updateTime?: Date
  download?: () => void
}

function DataAnalysisHeader(props: IDataAnalysisHeaderProps) {

  const {
    title,
    updateTime,
    download,
  } = props

  // 渲染数据更新时间
  const renderUpdateTime = useMemo(() => {
    if (!updateTime) return null
    return (
      <div>更新时间：{dayjs(updateTime).format('YYYY-MM-DD HH:mm:ss')}</div>
    )
  }, [updateTime])

  // 渲染下载按钮
  const renderDownloadButton = useMemo(() => {
    if (!download) return null
    return (
      <Button
        type="link"
        onClick={() => download()}
      >
        <Download theme="filled" size="16" fill="#333" />
        下载
      </Button>
    )
  }, [download])

  return (
    <div className={styles.header}>
      <div className={styles.title}>{title}</div>
      {renderUpdateTime}
      {renderDownloadButton}
    </div>
  )
}

export default memo(DataAnalysisHeader)
