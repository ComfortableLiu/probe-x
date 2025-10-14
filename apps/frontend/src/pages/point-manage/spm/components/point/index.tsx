import React, { memo, useEffect, useMemo, useState } from "react"
import { Button, Descriptions, DescriptionsProps, Empty, List, Popover, Space } from "antd"
import { AddOne } from "@icon-park/react"
import VirtualList from "rc-virtual-list"
import { IPointManageSpmState, ITrackingSpmListItem } from "@pages/point-manage/spm/type"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { IPointProps } from "@pages/point-manage/spm/components/point/type"
import { useModel } from "@/hooks"
import * as styles from "../../styles.module.scss"
import { classnames } from "@utils/classnames"

function Point(props: IPointProps) {

  const {
    selectedPage,
    selectedModule,
    selectedPoint,
    containerHeight,
    openPointEdit,
    openPointAdd,
    openModuleEdit,
  } = props

  const {
    trackingSpmList = [],
  } = useModel<IPointManageSpmState>('pointManageSpmModel')

  const dispatch = useDispatch<Dispatch>()
  const [loading, setLoading] = useState(false)

  const children = useMemo(() => (trackingSpmList.find((item) => item.code === selectedPage?.code)?.child?.trackingSpmList || []).find(item => item.code === selectedModule?.code)?.child, [selectedModule?.code, selectedPage?.code, trackingSpmList])

  const list = useMemo(() => children?.trackingSpmList || [], [children?.trackingSpmList])
  const pageSize = useMemo(() => children?.pageSize || 20, [children?.pageSize])
  const page = useMemo(() => children?.page || 1, [children?.page])
  const total = useMemo(() => children?.total || 0, [children?.total])

  const isFinish = useMemo(() => total <= (page * pageSize) || list?.length, [page, pageSize, total, list?.length])

  useEffect(() => {
    if (!selectedModule) return
    if (selectedModule.child) return
    setLoading(true)
    dispatch.pointManageSpmModel.getSpmNodeList({
      parentCode: selectedModule.code,
      page: 1,
      pageSize: 20,
    }).finally(() => {
      setLoading(false)
    })
  }, [dispatch.pointManageSpmModel, selectedModule])

  const onScrollPage = async (e: React.UIEvent<HTMLElement, UIEvent>) => {
    if (
      Math.abs(e.currentTarget.scrollHeight - e.currentTarget.scrollTop - containerHeight) <= 1
    ) {
      if (isFinish) return
      await dispatch.pointManageSpmModel.getSpmNodeList({
        parentCode: selectedModule.code,
        page: page + 1,
        pageSize,
      })
    }
  }

  const borderedItems: DescriptionsProps['items'] = useMemo(() => [
    {
      key: 'code',
      label: 'Code',
      span: 'filled',
      children: selectedModule?.code,
    },
    {
      key: 'description',
      label: '描述',
      span: 'filled',
      children: selectedModule?.description,
    },
  ], [selectedModule])

  const renderListView = useMemo(() => {
    if ((!selectedModule || !list?.length) && !loading) return null
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
              [styles.selected]: selectedPoint?.code === item.code,
            })}
          >
            <Popover
              trigger="contextMenu"
              placement="right"
              content={(
                <Space direction="vertical">
                  <a onClick={() => openPointEdit(item, selectedModule)}>修改</a>
                  {/*<a>删除</a>*/}
                </Space>
              )}
            >
              <a
                className={styles.link}
              >
                {item.name}（{item.code}）
              </a>
            </Popover>
          </List.Item>
        )}
      </VirtualList>
    )
  }, [containerHeight, list, loading, onScrollPage, openPointEdit, selectedModule, selectedPoint?.code])

  return (
    <div style={{ padding: 12 }}>
      <Space>
        <Button
          type="primary"
          onClick={() => openPointAdd(selectedModule)}
        >
          新增点位
          <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
        </Button>
      </Space>

      <List
        locale={{
          emptyText: selectedModule ? <Empty description="暂无点位" /> : <Empty description="请先选择一个模块" />,
        }}
        loading={loading}
        header={selectedModule ? (
          <Descriptions
            bordered
            title={selectedModule.name}
            size="small"
            style={{ height: 156 }}
            extra={
              <Button
                type="primary"
                onClick={() => openModuleEdit(selectedModule, selectedPage)}
              >
                编辑模块
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

export default memo(Point)