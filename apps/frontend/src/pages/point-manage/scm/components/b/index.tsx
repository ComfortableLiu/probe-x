import React, { memo, useCallback, useEffect, useMemo, useState } from "react"
import { Button, Descriptions, DescriptionsProps, Empty, List, Popover, Space } from "antd"
import { AddOne } from "@icon-park/react"
import VirtualList from "rc-virtual-list"
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
    containerHeight,
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

  const children = useMemo(() => trackingScmList.find((item) => item.code === selectedA?.code)?.child, [selectedA?.code, trackingScmList])

  const list = useMemo(() => children?.trackingScmList || [], [children])
  const pageSize = useMemo(() => children?.pageSize || 20, [children?.pageSize])
  const page = useMemo(() => children?.page || 1, [children?.page])
  const total = useMemo(() => children?.total || 0, [children?.total])

  const isFinish = useMemo(() => total <= (page * pageSize) || list?.length, [page, pageSize, total, list?.length])

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

  const onScrollB = useCallback(async (e: React.UIEvent<HTMLElement, UIEvent>) => {
    if (
      Math.abs(e.currentTarget.scrollHeight - e.currentTarget.scrollTop - containerHeight) <= 1
    ) {
      if (isFinish) return
      await dispatch.pointManageScmModel.getScmNodeList({
        parentCode: selectedA.code,
        page: page + 1,
        pageSize,
      })
    }
  }, [containerHeight, dispatch.pointManageScmModel, isFinish, page, pageSize, selectedA?.code])

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

  const renderListView = useMemo(() => {
    if ((!selectedA || !list?.length) && !loading) return null
    return (
      <VirtualList
        data={list}
        height={containerHeight}
        itemHeight={47}
        onScroll={onScrollB}
        itemKey="code"
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
      </VirtualList>
    )
  }, [containerHeight, list, loading, onScrollB, openBEdit, selectB, selectedB?.code, selectedA])

  return (
    <div style={{ padding: 12 }}>
      <Space>
        <Button
          type="primary"
          onClick={() => openBAdd(selectedA)}
        >
          新增B
          <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
        </Button>
      </Space>

      <List
        locale={{
          emptyText: selectedA ? <Empty description="暂无B" /> : <Empty description="请先选择一个A" />,
        }}
        loading={loading}
        header={selectedA ? (
          <Descriptions
            bordered
            title={selectedA.name}
            size="small"
            style={{ height: 156 }}
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
        {renderListView}
      </List>
    </div>
  )
}

export default memo(B)
