import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { Button, Descriptions, DescriptionsProps, Empty, List, Popover, Space } from "antd"
import { AddOne } from "@icon-park/react"
import TrackingNodePanel from "@pages/point-manage/components/TrackingNodePanel"
import { IPointManageScmState, ITrackingScmListItem } from "@pages/point-manage/scm/type"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { ICProps } from "@pages/point-manage/scm/components/c/type"
import { useModel } from "@/hooks"
import * as styles from "../../styles.module.scss"
import { classnames } from "@utils/classnames"

function C(props: ICProps) {

  const {
    selectedA,
    selectedB,
    selectedC,
    openCEdit,
    openCAdd,
    openBEdit,
    selectC,
  } = props

  const {
    trackingScmList = [],
  } = useModel<IPointManageScmState>('pointManageScmModel')

  const dispatch = useDispatch<Dispatch>()
  const [loading, setLoading] = useState(false)
  const loadMoreInFlight = useRef(false)

  const children = useMemo(() => (trackingScmList.find((item) => item.code === selectedA?.code)?.child?.trackingScmList || []).find(item => item.code === selectedB?.code)?.child, [selectedB?.code, selectedA?.code, trackingScmList])

  const list = useMemo(() => children?.trackingScmList || [], [children?.trackingScmList])
  const pageSize = useMemo(() => children?.pageSize || 20, [children?.pageSize])
  const page = useMemo(() => children?.page || 1, [children?.page])
  const total = useMemo(() => children?.total || 0, [children?.total])

  const isFinish = useMemo(() => total <= (page * pageSize), [page, pageSize, total])

  useEffect(() => {
    if (!selectedB) return
    if (selectedB.child) return
    setLoading(true)
    dispatch.pointManageScmModel.getScmNodeList({
      parentCode: selectedB.code,
      page: 1,
      pageSize: 20,
    }).finally(() => {
      setLoading(false)
    })
  }, [dispatch.pointManageScmModel, selectedB])

  const onScrollC = async (e: React.UIEvent<HTMLElement, UIEvent>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight > 16 || !selectedB || isFinish || loading || loadMoreInFlight.current) return

    loadMoreInFlight.current = true
    setLoading(true)
    try {
      await dispatch.pointManageScmModel.getScmNodeList({
        parentCode: selectedB.code,
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
      children: selectedB?.code,
    },
    {
      key: 'description',
      label: '描述',
      span: 'filled',
      children: selectedB?.description,
    },
  ], [selectedB])

  return (
    <TrackingNodePanel
      actions={(
        <Space>
          <Button
            type="primary"
            onClick={() => openCAdd(selectedB)}
          >
            新增C
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        </Space>
      )}
      data={list}
      loading={loading}
      onScroll={onScrollC}
      emptyText={selectedB ? <Empty description="暂无C" /> : <Empty description="请先选择一个B" />}
      header={selectedB ? (
        <Descriptions
          bordered
          title={selectedB.name}
          size="small"
          extra={
            <Button
              type="primary"
              onClick={() => openBEdit(selectedB, selectedA)}
            >
              编辑B
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
            [styles.selected]: selectedC?.code === item.code,
          })}
        >
          <Popover
            trigger="contextMenu"
            placement="right"
            content={(
              <Space direction="vertical">
                <a onClick={() => openCEdit(item, selectedB)}>修改</a>
                {/*<a>删除</a>*/}
              </Space>
            )}
          >
            <a
              className={styles.link}
              onClick={() => selectC(item)}
            >
              {item.name}（{item.code}）
            </a>
          </Popover>
        </List.Item>
      )}
    </TrackingNodePanel>
  )
}

export default memo(C)
