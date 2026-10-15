import React, { memo, useMemo, useRef, useState } from "react"
import { Button, List, Popover, Space } from "antd"
import { AddOne } from "@icon-park/react"
import TrackingNodePanel from "@pages/point-manage/components/TrackingNodePanel"
import { IPointManageSpmState, ITrackingSpmListItem } from "@pages/point-manage/spm/type"
import { IPageProps } from "@pages/point-manage/spm/components/page/type"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { useModel } from "@/hooks"
import * as styles from "../../styles.module.scss"
import { classnames } from "@utils/classnames"

function Page(props: IPageProps) {

  const {
    selectedPage,
    openPageEdit,
    openPageAdd,
    selectPage,
  } = props

  const {
    trackingSpmList = [],
    pageSize,
    page,
    total,
  } = useModel<IPointManageSpmState>('pointManageSpmModel')

  const dispatch = useDispatch<Dispatch>()
  const [loading, setLoading] = useState(false)
  const loadingMore = useRef(false)

  const isFinish = useMemo(() => total <= (page * pageSize), [page, pageSize, total])

  const onScrollPage = async (e: React.UIEvent<HTMLElement, UIEvent>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight > 16 || isFinish || loading || loadingMore.current) return
    loadingMore.current = true
    setLoading(true)
    try {
      await dispatch.pointManageSpmModel.getSpmNodeList({
        page: page + 1,
        pageSize,
      })
    } finally {
      loadingMore.current = false
      setLoading(false)
    }
  }

  return (
    <TrackingNodePanel
      actions={(
        <Space>
          <Button
            type="primary"
            onClick={() => openPageAdd()}
          >
            新增页面
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        </Space>
      )}
      data={trackingSpmList}
      loading={loading}
      onScroll={onScrollPage}
    >
      {(item: ITrackingSpmListItem) => (
        <List.Item
          key={item.code}
          style={{ padding: 0 }}
          className={classnames(styles.listItem, {
            [styles.selected]: selectedPage?.code === item.code,
          })}
        >
          <Popover
            trigger="contextMenu"
            placement="right"
            content={(
              <Space direction="vertical">
                <a onClick={() => openPageEdit(item)}>修改</a>
                {/*<a>删除</a>*/}
              </Space>
            )}
          >
            <a
              className={styles.link}
              onClick={() => selectPage(item)}
            >
              {item.name}（{item.code}）
            </a>
          </Popover>
        </List.Item>
      )}
    </TrackingNodePanel>
  )
}

export default memo(Page)
