import React, { cloneElement, ReactElement, useCallback, useMemo } from 'react'
import { Button, Tooltip } from 'antd'
import type { ITooltipProps } from './types'
import { clipboard as clipboardFun } from '@/utils'
import * as styles from './styles.module.scss'

/**
 * 悬浮操作
 */
export default function ({ children, clipboard, open, extra, style }: ITooltipProps) {

  const handleCopy = (e: any) => {
    e.stopPropagation()
    clipboard && clipboardFun(clipboard)
  }

  const handleOpen = useCallback((e: any) => {
    e.stopPropagation()
    if (!open || typeof open == 'boolean') return

    const _url = typeof open === 'string' ? open : open.pathname
    const _target = typeof open === 'string' ? '' : open.target

    if (_url.includes('http') || _target) {
      window.open(_url, _target)
    } else {
      window.open(_url, "_blank")
    }
  }, [open])

  const operateList = useMemo<ReactElement[]>(() => {
    const _operateList: ReactElement[] = []
    if (clipboard) {
      _operateList.push(
        <Button type="primary" size="small" onClick={handleCopy}>
          复制
        </Button>,
      )
    }
    if (open) {
      _operateList.push(
        <Button type="primary" size="small" onClick={handleOpen}>
          打开
        </Button>,
      )
    }

    if (extra && extra.length > 0) {
      // @ts-ignore
      _operateList.push(...extra.filter(Boolean).map((item) => cloneElement(item, { size: 'small' })))
    }
    return _operateList
  }, [clipboard, open, extra, handleCopy, handleOpen])

  const titleNode: React.ReactNode = useMemo(() => (
    <div className={styles.titleNodeBox}>
      {operateList.map((item, index: number) => (
        item && <div key={index} className={styles.element}>
          {item}
        </div>
      ))}
    </div>
  ), [operateList])

  if (operateList.length <= 0) return <>{children}</>

  return (
    <Tooltip
      title={titleNode}
      placement="top"
      color="#fff"
      autoAdjustOverflow
      arrow
      className={styles.tooltipContainer}
      mouseLeaveDelay={.2}
    >
      <span className={styles.hoverBtnBox} style={{ ...style }}>{children}</span>
    </Tooltip>
  )
}
