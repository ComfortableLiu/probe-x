import React, { memo, useMemo, useRef, useState } from "react"
import { Button, List, Popover, Space } from "antd"
import { AddOne } from "@icon-park/react"
import TrackingNodePanel from "@pages/point-manage/components/TrackingNodePanel"
import { IPointManageScmState, ITrackingScmListItem } from "@pages/point-manage/scm/type"
import { IAProps } from "@pages/point-manage/scm/components/a/type"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { useModel } from "@/hooks"
import * as styles from "../../styles.module.scss"
import { classnames } from "@utils/classnames"

function A(props: IAProps) {

  const {
    selectedA,
    openAEdit,
    openAAdd,
    selectA,
  } = props

  const {
    trackingScmList = [],
    pageSize,
    page,
    total,
  } = useModel<IPointManageScmState>('pointManageScmModel')

  const dispatch = useDispatch<Dispatch>()
  const [loading, setLoading] = useState(false)
  const loadMoreInFlight = useRef(false)

  const isFinish = useMemo(() => total <= (page * pageSize), [page, pageSize, total])

  const onScrollA = async (e: React.UIEvent<HTMLElement, UIEvent>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight > 16 || isFinish || loading || loadMoreInFlight.current) return

    loadMoreInFlight.current = true
    setLoading(true)
    try {
      await dispatch.pointManageScmModel.getScmNodeList({
        page: page + 1,
        pageSize,
      })
    } finally {
      loadMoreInFlight.current = false
      setLoading(false)
    }
  }

  return (
    <TrackingNodePanel
      actions={(
        <Space>
          <Button
            type="primary"
            onClick={() => openAAdd()}
          >
            新增A
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        </Space>
      )}
      data={trackingScmList}
      loading={loading}
      onScroll={onScrollA}
    >
      {(item: ITrackingScmListItem) => (
        <List.Item
          key={item.code}
          style={{ padding: 0 }}
          className={classnames(styles.listItem, {
            [styles.selected]: selectedA?.code === item.code,
          })}
        >
          <Popover
            trigger="contextMenu"
            placement="right"
            content={(
              <Space direction="vertical">
                <a onClick={() => openAEdit(item)}>修改</a>
                {/*<a>删除</a>*/}
              </Space>
            )}
          >
            <a
              className={styles.link}
              onClick={() => selectA(item)}
            >
              {item.name}（{item.code}）
            </a>
          </Popover>
        </List.Item>
      )}
    </TrackingNodePanel>
  )
}

export default memo(A)
