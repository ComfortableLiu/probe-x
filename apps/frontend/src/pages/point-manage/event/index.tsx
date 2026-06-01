import React, { useCallback, useMemo, useState } from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { useHistoryListener, useLoading, useModel, useQuery } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { IEventListItem, IPointManageEventState } from "@pages/point-manage/event/type"
import { IFormItem } from "@components/FormComponent/type"
import { Form, Input, Modal, Space, Tag, message, TableProps } from "antd"
import { FormItemType } from "@components/FormComponent/constants"
import dayjs from "dayjs"
import EventDetail from "@pages/point-manage/event/components/detail"
import PageHeader from "@components/PageHeader"
import { registerEvent } from "@pages/point-manage/event/services"
import * as styles from "./styles.module.scss"

function EventManage() {

  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()

  const {
    eventList,
    pageSize,
    page,
    total,
  } = useModel<IPointManageEventState>('pointManageEventModel')

  const query = useQuery<{ source?: string }>()

  const filteredEventList = useMemo(() => {
    if (!query.source) return eventList
    return eventList.filter(item => item.source === query.source)
  }, [eventList, query.source])

  useHistoryListener((location) => {
    const { pathname } = location
    if (pathname === '/point-manage/event') {
      dispatch.pointManageEventModel.getEventList()
    }
  })

  const handleRefresh = useCallback(() => {
    dispatch.pointManageEventModel.getEventList()
  }, [dispatch])

  const [selectedEvent, setSelectedEvent] = useState<IEventListItem | null>(null)
  const [registerModalVisible, setRegisterModalVisible] = useState(false)
  const [registerEventName, setRegisterEventName] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerForm] = Form.useForm()

  const openEventDetail = useCallback((event: IEventListItem) => {
    setSelectedEvent(event)
  }, [])

  const openRegisterModal = useCallback((event: IEventListItem) => {
    setRegisterEventName(event.eventName)
    setRegisterModalVisible(true)
    registerForm.setFieldsValue({
      eventAliases: '',
      eventRemark: '',
    })
  }, [registerForm])

  const handleRegister = useCallback(async () => {
    try {
      const values = await registerForm.validateFields()
      setRegisterLoading(true)
      await registerEvent({
        eventName: registerEventName,
        eventAliases: values.eventAliases,
        eventRemark: values.eventRemark,
      })
      message.success('注册成功')
      setRegisterModalVisible(false)
      handleRefresh()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || '注册失败')
    } finally {
      setRegisterLoading(false)
    }
  }, [registerEventName, registerForm, handleRefresh])

  const formItems: IFormItem[] = useMemo(() => [{
    key: 'eventName',
    label: '事件名',
    type: FormItemType.TEXT,
  }, {
    key: 'status',
    label: '事件状态',
    type: FormItemType.TEXT,
    disabled: true,
  }, {
    key: 'source',
    label: '来源',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: '已配置', value: 'configured' },
      { label: '上报发现', value: 'reported' },
    ],
  }], [])

  const columns: TableProps<IEventListItem>['columns'] = useMemo(() => [{
    title: '事件名',
    dataIndex: 'eventName',
    width: 150,
    fixed: 'left',
    render: (text, record) => record.source === 'configured'
      ? <a onClick={() => openEventDetail(record)}>{text}</a>
      : <span>{text}</span>,
  }, {
    title: '来源',
    dataIndex: 'source',
    width: 100,
    render: (source: 'configured' | 'reported') => (
      <Tag color={source === 'configured' ? 'green' : 'orange'}>
        {source === 'configured' ? '已配置' : '上报发现'}
      </Tag>
    ),
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
    render: text => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
  }, {
    title: '更新人',
    dataIndex: 'updateNickname',
    width: 150,
  }, {
    title: '更新时间',
    dataIndex: 'updateTime',
    render: text => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    width: 150,
  }, {
    title: '操作',
    key: 'action',
    width: 120,
    fixed: 'right',
    render: (text, record) => (
      <Space>
        {record.source === 'configured' && (
          <a onClick={() => openEventDetail(record)}>详情</a>
        )}
        {record.source === 'reported' && (
          <a onClick={() => openRegisterModal(record)}>补充信息</a>
        )}
      </Space>
    ),
  }], [openEventDetail, openRegisterModal])

  return (
    <div className={styles.container}>
      <PageHeader
        title="事件管理"
        onRefresh={handleRefresh}
        loading={loading.pointManageEventModel.getEventList}
      />
      <FormComponent
        formItems={formItems}
      />
      <TableComponent<IEventListItem>
        dataSource={filteredEventList}
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
      <Modal
        title="注册事件"
        open={registerModalVisible}
        onOk={handleRegister}
        onCancel={() => setRegisterModalVisible(false)}
        confirmLoading={registerLoading}
        okText="注册"
        cancelText="取消"
      >
        <Form
          form={registerForm}
          layout="vertical"
        >
          <Form.Item label="事件名">
            <Input value={registerEventName} disabled />
          </Form.Item>
          <Form.Item
            label="事件别名"
            name="eventAliases"
          >
            <Input placeholder="请输入事件别名" />
          </Form.Item>
          <Form.Item
            label="事件描述"
            name="eventRemark"
          >
            <Input placeholder="请输入事件描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default EventManage
