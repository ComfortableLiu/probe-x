import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { Button, Descriptions, DescriptionsProps, Empty, List, Popover, Space } from "antd"
import { AddOne } from "@icon-park/react"
import TrackingNodePanel from "@pages/point-manage/components/TrackingNodePanel"
import { IPointManageScmState, ITrackingScmListItem } from "@pages/point-manage/scm/type"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { IBProps } from "@pages/point-manage/scm/components/b/type"
import { useModel } from "@/hooks"
import { classnames } from "@utils/classnames"
import * as styles from "../../styles.module.scss"

function B(props: IBProps) {

  const {
    selectedA,
    selectedB,
    openBEdit,
    openBAdd,
    openAEdit,
    selectB,
  } = props

  const {
    trackingScmList = [],
  } = useModel<IPointManageScmState>('pointManageScmModel')

  const dispatch = useDispatch<Dispatch>()
  const [loading, setLoading] = useState(false)
  const loadMoreInFlight = useRef(false)

  const children = useMemo(() => trackingScmList.find((item) => item.code === selectedA?.code)?.child, [selectedA?.code, trackingScmList])

  const list = useMemo(() => children?.trackingScmList || [], [children])
  const pageSize = useMemo(() => children?.pageSize || 20, [children?.pageSize])
  const page = useMemo(() => children?.page || 1, [children?.page])
  const total = useMemo(() => children?.total || 0, [children?.total])

  const isFinish = useMemo(() => total <= (page * pageSize), [page, pageSize, total])

  useEffect(() => {
    if (!selectedA) return
    if (selectedA.child) return
    setLoading(true)
    dispatch.pointManageScmModel.getScmNodeList({
      parentCode: selectedA.code,
      page: 1,
      pageSize: 20,
    }).finally(() => {
      setLoading(false)
    })
  }, [dispatch.pointManageScmModel, selectedA])

  const onScrollB = async (e: React.UIEvent<HTMLElement, UIEvent>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight > 16 || !selectedA || isFinish || loading || loadMoreInFlight.current) return

    loadMoreInFlight.current = true
    setLoading(true)
    try {
      await dispatch.pointManageScmModel.getScmNodeList({
        parentCode: selectedA.code,
        page: page + 1,
        pageSize,
      })
    } finally {
      loadMoreInFlight.current = false
      setLoading(false)
    }
  }

  const borderedItems: DescriptionsProps['items'] = useMemo(() => [
    {
      key: 'code',
      label: 'Code',
      span: 'filled',
      children: selectedA?.code,
    },
    {
      key: 'description',
      label: '描述',
      span: 'filled',
      children: selectedA?.description,
    },
  ], [selectedA])

  return (
    <TrackingNodePanel
      actions={(
        <Space>
          <Button
            type="primary"
            onClick={() => openBAdd(selectedA)}
          >
            新增B
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        </Space>
      )}
      data={list}
      loading={loading}
      onScroll={onScrollB}
      emptyText={selectedA ? <Empty description="暂无B" /> : <Empty description="请先选择一个A" />}
      header={selectedA ? (
        <Descriptions
          bordered
          title={selectedA.name}
          size="small"
          extra={
            <Button
              type="primary"
              onClick={() => openAEdit(selectedA)}
            >
              编辑A
            </Button>
          }
          items={borderedItems}
        />
      ) : null}
    >
      {(item: ITrackingScmListItem) => (
        <List.Item
          key={item.code}
          style={{ padding: 0 }}
          className={classnames(styles.listItem, {
            [styles.selected]: selectedB?.code === item.code,
          })}
        >
          <Popover
            trigger="contextMenu"
            content={(
              <Space direction="vertical">
                <a onClick={() => openBEdit(item, selectedA)}>修改</a>
                {/*<a>删除</a>*/}
              </Space>
            )}
          >
            <a
              className={styles.link}
              onClick={() => selectB(item)}
            >
              {item.name}（{item.code}）
            </a>
          </Popover>
        </List.Item>
      )}
    </TrackingNodePanel>
  )
}

export default memo(B)
