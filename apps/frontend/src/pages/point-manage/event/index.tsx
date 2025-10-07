import React, { useCallback, useMemo, useState } from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { useHistoryListener, useLoading, useModel } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { IEventListItem, IPointManageEventState } from "@pages/point-manage/event/type"
import { IFormItem } from "@components/FormComponent/type"
import { Space, TableProps } from "antd"
import { FormItemType } from "@components/FormComponent/constants"
import dayjs from "dayjs"
import EventDetail from "@pages/point-manage/event/components/detail"

function EventManage() {

  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()

  const {
    eventList,
    pageSize,
    page,
    total,
  } = useModel<IPointManageEventState>('pointManageEventModel')

  useHistoryListener((location) => {
    const { pathname } = location
    if (pathname === '/point-manage/event') {
      dispatch.pointManageEventModel.getEventList()
    }
  })

  const [selectedEvent, setSelectedEvent] = useState<IEventListItem | null>(null)

  const openEventDetail = useCallback((event: IEventListItem) => {
    setSelectedEvent(event)
  }, [])

  const formItems: IFormItem[] = useMemo(() => [{
    key: 'eventName',
    label: '事件名',
    type: FormItemType.TEXT,
  }, {
    key: 'status',
    label: '事件状态',
    type: FormItemType.TEXT,
    disabled: true,
  }], [])

  const columns: TableProps<IEventListItem>['columns'] = useMemo(() => [{
    title: '事件名',
    dataIndex: 'eventName',
    width: 150,
    fixed: 'left',
    render: text => <a onClick={() => openEventDetail(text)}>{text}</a>,
  }, {
    title: '事件别名',
    dataIndex: 'eventAliases',
    width: 150,
  }, {
    title: '事件描述',
    dataIndex: 'eventRemark',
    width: 250,
  }, {
    title: '创建人',
    dataIndex: 'createNickname',
    width: 150,
  }, {
    title: '创建时间',
    dataIndex: 'createTime',
    width: 150,
    render: text => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
  }, {
    title: '更新人',
    dataIndex: 'updateNickname',
    width: 150,
  }, {
    title: '更新时间',
    dataIndex: 'updateTime',
    render: text => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    width: 150,
  }, {
    title: '操作',
    key: 'action',
    width: 80,
    fixed: 'right',
    render: (text, record) => (
      <Space>
        <a onClick={() => openEventDetail(record)}>详情</a>
      </Space>
    ),
  }], [openEventDetail])

  return (
    <div>
      <h2>事件管理</h2>
      <FormComponent
        formItems={formItems}
      />
      <TableComponent<IEventListItem>
        dataSource={eventList}
        columns={columns}
        loading={loading.pointManageEventModel.getEventList}
        paginationData={{
          total: total,
          current: page,
          pageSize: pageSize,
        }}
      />
      <EventDetail
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  )
}

export default EventManage
