import React, { useLayoutEffect, useRef, useState } from 'react'
import { Empty, List } from 'antd'
import VirtualList from 'rc-virtual-list'
import * as styles from './styles.module.scss'

interface TrackingNodePanelProps<T> {
  actions: React.ReactNode
  header?: React.ReactNode
  emptyText?: React.ReactNode
  loading?: boolean
  data: T[]
  onScroll?: React.UIEventHandler<HTMLElement>
  children: (item: T, index: number) => React.ReactNode
}

/** 每列只让列表滚动，列表视口随说明展开、分栏拖动和窗口缩放自动更新。 */
function TrackingNodePanel<T extends { code: string }>(props: TrackingNodePanelProps<T>) {
  const { actions, header, emptyText, loading, data, onScroll, children } = props
  const viewportRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () => setHeight(Math.max(0, Math.floor(viewport.getBoundingClientRect().height)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={styles.panel}>
      <div className={styles.actions}>{actions}</div>
      <List className={styles.list} loading={loading} header={header}>
        <div ref={viewportRef} className={styles.viewport}>
          {data.length > 0 ? (
            <VirtualList
              data={data}
              height={height}
              itemHeight={47}
              itemKey="code"
              onScroll={onScroll}
            >
              {children}
            </VirtualList>
          ) : emptyText || <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
        </div>
      </List>
    </div>
  )
}

export default TrackingNodePanel
