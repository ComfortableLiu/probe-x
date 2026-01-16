import React, { memo, useMemo, useState } from "react"
import { Button, List, Popover, Space } from "antd"
import { AddOne } from "@icon-park/react"
import VirtualList from "rc-virtual-list"
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
    containerHeight,
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

  const isFinish = useMemo(() => total <= (page * pageSize) || trackingScmList?.length, [page, pageSize, total, trackingScmList?.length])

  const listHeight = useMemo(() => {
    // 因为A栏这里没有详情内容，所以要将其高度加上去
    return containerHeight + 156 + 24 + 2
  }, [containerHeight])

  const onScrollA = async (e: React.UIEvent<HTMLElement, UIEvent>) => {
    if (
      Math.abs(e.currentTarget.scrollHeight - e.currentTarget.scrollTop - listHeight) <= 1
    ) {
      if (isFinish) return
      setLoading(true)
      await dispatch.pointManageScmModel.getScmNodeList({
        page: page + 1,
        pageSize,
      })
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 12 }}>
      <Space>
        <Button
          type="primary"
          onClick={() => openAAdd()}
        >
          新增A
          <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
        </Button>
      </Space>

      <List
        loading={loading}
      >
        <VirtualList
          data={trackingScmList}
          height={listHeight}
          onScroll={onScrollA}
          itemKey="code"
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
        </VirtualList>
      </List>
    </div>
  )
}

export default memo(A)
