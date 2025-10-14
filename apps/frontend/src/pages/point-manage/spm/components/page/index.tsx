import React, { memo, useMemo, useState } from "react"
import { Button, List, Popover, Space } from "antd"
import { AddOne } from "@icon-park/react"
import VirtualList from "rc-virtual-list"
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
    containerHeight,
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

  const isFinish = useMemo(() => total <= (page * pageSize) || trackingSpmList?.length, [page, pageSize, total, trackingSpmList?.length])

  const listHeight = useMemo(() => {
    // 因为页面这里没有详情内容，所以要将其高度加上去
    return containerHeight + 156 + 24 + 2
  }, [containerHeight])

  const onScrollPage = async (e: React.UIEvent<HTMLElement, UIEvent>) => {
    if (
      Math.abs(e.currentTarget.scrollHeight - e.currentTarget.scrollTop - listHeight) <= 1
    ) {
      if (isFinish) return
      setLoading(true)
      await dispatch.pointManageSpmModel.getSpmNodeList({
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
          onClick={() => openPageAdd()}
        >
          新增页面
          <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
        </Button>
      </Space>

      <List
        loading={loading}
      >
        <VirtualList
          data={trackingSpmList}
          height={listHeight}
          onScroll={onScrollPage}
          itemKey="code"
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
        </VirtualList>
      </List>
    </div>
  )
}

export default memo(Page)