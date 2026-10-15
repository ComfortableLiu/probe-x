import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { Button, Descriptions, DescriptionsProps, Empty, List, Popover, Space } from "antd"
import { AddOne } from "@icon-park/react"
import TrackingNodePanel from "@pages/point-manage/components/TrackingNodePanel"
import { IPointManageScmState, ITrackingScmListItem } from "@pages/point-manage/scm/type"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { IDProps } from "@pages/point-manage/scm/components/d/type"
import { useModel } from "@/hooks"
import * as styles from "../../styles.module.scss"
import { classnames } from "@utils/classnames"

function D(props: IDProps) {

  const {
    selectedA,
    selectedB,
    selectedC,
    selectedD,
    openDEdit,
    openDAdd,
    openCEdit,
    selectD,
  } = props

  const {
    trackingScmList = [],
  } = useModel<IPointManageScmState>('pointManageScmModel')

  const dispatch = useDispatch<Dispatch>()
  const [loading, setLoading] = useState(false)
  const loadMoreInFlight = useRef(false)

  const children = useMemo(() => {
    const bList = trackingScmList.find((item) => item.code === selectedA?.code)?.child?.trackingScmList || []
    const cList = bList.find(item => item.code === selectedB?.code)?.child?.trackingScmList || []
    return cList.find(item => item.code === selectedC?.code)?.child
  }, [selectedC?.code, selectedB?.code, selectedA?.code, trackingScmList])

  const list = useMemo(() => children?.trackingScmList || [], [children?.trackingScmList])
  const pageSize = useMemo(() => children?.pageSize || 20, [children?.pageSize])
  const page = useMemo(() => children?.page || 1, [children?.page])
  const total = useMemo(() => children?.total || 0, [children?.total])

  const isFinish = useMemo(() => total <= (page * pageSize), [page, pageSize, total])

  useEffect(() => {
    if (!selectedC) return
    if (selectedC.child) return
    setLoading(true)
    dispatch.pointManageScmModel.getScmNodeList({
      parentCode: selectedC.code,
      page: 1,
      pageSize: 20,
    }).finally(() => {
      setLoading(false)
    })
  }, [dispatch.pointManageScmModel, selectedC])

  const onScrollD = async (e: React.UIEvent<HTMLElement, UIEvent>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight > 16 || !selectedC || isFinish || loading || loadMoreInFlight.current) return

    loadMoreInFlight.current = true
    setLoading(true)
    try {
      await dispatch.pointManageScmModel.getScmNodeList({
        parentCode: selectedC.code,
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
      children: selectedC?.code,
    },
    {
      key: 'description',
      label: '描述',
      span: 'filled',
      children: selectedC?.description,
    },
  ], [selectedC])

  return (
    <TrackingNodePanel
      actions={(
        <Space>
          <Button
            type="primary"
            onClick={() => openDAdd(selectedC)}
          >
            新增D
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        </Space>
      )}
      data={list}
      loading={loading}
      onScroll={onScrollD}
      emptyText={selectedC ? <Empty description="暂无D" /> : <Empty description="请先选择一个C" />}
      header={selectedC ? (
        <Descriptions
          bordered
          title={selectedC.name}
          size="small"
          extra={
            <Button
              type="primary"
              onClick={() => openCEdit(selectedC, selectedB)}
            >
              编辑C
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
            [styles.selected]: selectedD?.code === item.code,
          })}
        >
          <Popover
            trigger="contextMenu"
            placement="right"
            content={(
              <Space direction="vertical">
                <a onClick={() => openDEdit(item, selectedC)}>修改</a>
                {/*<a>删除</a>*/}
              </Space>
            )}
          >
            <a
              className={styles.link}
              onClick={() => selectD(item)}
            >
              {item.name}（{item.code}）
            </a>
          </Popover>
        </List.Item>
      )}
    </TrackingNodePanel>
  )
}

export default memo(D)
