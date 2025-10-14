import React, { memo, useCallback, useEffect, useMemo, useState } from "react"
import { Button, Descriptions, DescriptionsProps, Empty, List, Popover, Space } from "antd"
import { AddOne } from "@icon-park/react"
import VirtualList from "rc-virtual-list"
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
    containerHeight,
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

  const children = useMemo(() => trackingSpmList.find((item) => item.code === selectedPage?.code)?.child, [selectedPage?.code, trackingSpmList])

  const list = useMemo(() => children?.trackingSpmList || [], [children])
  const pageSize = useMemo(() => children?.pageSize || 20, [children?.pageSize])
  const page = useMemo(() => children?.page || 1, [children?.page])
  const total = useMemo(() => children?.total || 0, [children?.total])

  const isFinish = useMemo(() => total <= (page * pageSize) || list?.length, [page, pageSize, total, list?.length])

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
    if (
      Math.abs(e.currentTarget.scrollHeight - e.currentTarget.scrollTop - containerHeight) <= 1
    ) {
      if (isFinish) return
      await dispatch.pointManageSpmModel.getSpmNodeList({
        parentCode: selectedPage.code,
        page: page + 1,
        pageSize,
      })
    }
  }, [containerHeight, dispatch.pointManageSpmModel, isFinish, page, pageSize, selectedPage?.code])

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

  const renderListView = useMemo(() => {
    if ((!selectedPage || !list?.length) && !loading) return null
    return (
      <VirtualList
        data={list}
        height={containerHeight}
        itemHeight={47}
        onScroll={onScrollPage}
        itemKey="code"
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
      </VirtualList>
    )
  }, [containerHeight, list, loading, onScrollPage, openModuleEdit, selectModule, selectedModule?.code, selectedPage])

  return (
    <div style={{ padding: 12 }}>
      <Space>
        <Button
          type="primary"
          onClick={() => openModuleAdd(selectedPage)}
        >
          新增模块
          <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
        </Button>
      </Space>

      <List
        locale={{
          emptyText: selectedPage ? <Empty description="暂无模块" /> : <Empty description="请先选择一个页面" />,
        }}
        loading={loading}
        header={selectedPage ? (
          <Descriptions
            bordered
            title={selectedPage.name}
            size="small"
            style={{ height: 156 }}
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
        {renderListView}
      </List>
    </div>
  )
}

export default memo(Module)