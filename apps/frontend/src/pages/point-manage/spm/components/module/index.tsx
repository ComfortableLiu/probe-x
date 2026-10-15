import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button, Descriptions, DescriptionsProps, Empty, List, Popover, Space } from "antd"
import { AddOne } from "@icon-park/react"
import TrackingNodePanel from "@pages/point-manage/components/TrackingNodePanel"
import { IPointManageSpmState, ITrackingSpmListItem } from "@pages/point-manage/spm/type"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { IModuleProps } from "@pages/point-manage/spm/components/module/type"
import { useModel } from "@/hooks"
import { classnames } from "@utils/classnames"
import * as styles from "../../styles.module.scss"

function Module(props: IModuleProps) {

  const {
    selectedPage,
    selectedModule,
    openModuleEdit,
    openModuleAdd,
    openPageEdit,
    selectModule,
  } = props

  const {
    trackingSpmList = [],
  } = useModel<IPointManageSpmState>('pointManageSpmModel')

  const dispatch = useDispatch<Dispatch>()
  const [loading, setLoading] = useState(false)
  const loadingMore = useRef(false)

  const children = useMemo(() => trackingSpmList.find((item) => item.code === selectedPage?.code)?.child, [selectedPage?.code, trackingSpmList])

  const list = useMemo(() => children?.trackingSpmList || [], [children])
  const pageSize = useMemo(() => children?.pageSize || 20, [children?.pageSize])
  const page = useMemo(() => children?.page || 1, [children?.page])
  const total = useMemo(() => children?.total || 0, [children?.total])

  const isFinish = useMemo(() => total <= (page * pageSize), [page, pageSize, total])

  useEffect(() => {
    if (!selectedPage) return
    if (selectedPage.child) return
    setLoading(true)
    dispatch.pointManageSpmModel.getSpmNodeList({
      parentCode: selectedPage.code,
      page: 1,
      pageSize: 20,
    }).finally(() => {
      setLoading(false)
    })
  }, [dispatch.pointManageSpmModel, selectedPage])

  const onScrollPage = useCallback(async (e: React.UIEvent<HTMLElement, UIEvent>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight > 16 || !selectedPage || isFinish || loading || loadingMore.current) return
    loadingMore.current = true
    setLoading(true)
    try {
      await dispatch.pointManageSpmModel.getSpmNodeList({
        parentCode: selectedPage.code,
        page: page + 1,
        pageSize,
      })
    } finally {
      loadingMore.current = false
      setLoading(false)
    }
  }, [dispatch.pointManageSpmModel, isFinish, loading, page, pageSize, selectedPage])

  const borderedItems: DescriptionsProps['items'] = useMemo(() => [
    {
      key: 'code',
      label: 'Code',
      span: 'filled',
      children: selectedPage?.code,
    },
    {
      key: 'description',
      label: '描述',
      span: 'filled',
      children: selectedPage?.description,
    },
  ], [selectedPage])

  return (
    <TrackingNodePanel
      actions={(
        <Space>
          <Button
            type="primary"
            onClick={() => openModuleAdd(selectedPage)}
          >
            新增模块
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        </Space>
      )}
      data={list}
      loading={loading}
      onScroll={onScrollPage}
      emptyText={selectedPage ? <Empty description="暂无模块" /> : <Empty description="请先选择一个页面" />}
      header={selectedPage ? (
        <Descriptions
          bordered
          title={selectedPage.name}
          size="small"
          extra={
            <Button
              type="primary"
              onClick={() => openPageEdit(selectedPage)}
            >
              编辑页面
            </Button>
          }
          items={borderedItems}
        />
      ) : null}
    >
      {(item: ITrackingSpmListItem) => (
        <List.Item
          key={item.code}
          style={{ padding: 0 }}
          className={classnames(styles.listItem, {
            [styles.selected]: selectedModule?.code === item.code,
          })}
        >
          <Popover
            trigger="contextMenu"
            content={(
              <Space direction="vertical">
                <a onClick={() => openModuleEdit(item, selectedPage)}>修改</a>
                {/*<a>删除</a>*/}
              </Space>
            )}
          >
            <a
              className={styles.link}
              onClick={() => selectModule(item)}
            >
              {item.name}（{item.code}）
            </a>
          </Popover>
        </List.Item>
      )}
    </TrackingNodePanel>
  )
}

export default memo(Module)
