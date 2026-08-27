import React, { useCallback, useMemo, useState } from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import { Button, Popconfirm, Space, TableProps, Tag } from "antd"
import { AddOne } from "@icon-park/react"
import dayjs from "dayjs"
import { useHistoryListener, useLoading, useModel } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { ICreateNotificationReq, INotificationListItem, INotificationManageState, IUpdateNotificationReq } from "./type"
import * as styles from "./styles.module.scss"
import NotificationEditPopup from "./components/EditPopup"
import PageHeader from "@components/PageHeader"

const typeMap: Record<string, string> = {
  webhook: 'Webhook',
  email: '邮件',
  sms: '短信',
}

function Notification() {
  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { notificationList, pagination } = useModel<INotificationManageState>('systemConfigNotificationModel')

  const [editPopupOpen, setEditPopupOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<INotificationListItem | null>(null)

  useHistoryListener((location) => {
    if (location.pathname === '/system-config/notification') {
      dispatch.systemConfigNotificationModel.getNotificationList()
    }
  })

  const formItems: IFormItem[] = useMemo(() => [{
    key: 'notificationName',
    label: '通知名称',
    type: FormItemType.TEXT,
  }, {
    key: 'notificationType',
    label: '通知类型',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: 'Webhook', value: 'webhook' },
      { label: '邮件', value: 'email' },
      { label: '短信', value: 'sms' },
    ],
  }, {
    key: 'isEnable',
    label: '状态',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: '启用', value: true },
      { label: '禁用', value: false },
    ],
  }], [])

  const handleAdd = useCallback(() => {
    setSelectedRecord(null)
    setEditPopupOpen(true)
  }, [])

  const handleEdit = useCallback((record: INotificationListItem) => {
    setSelectedRecord(record)
    setEditPopupOpen(true)
  }, [])

  const handleDelete = useCallback(async (record: INotificationListItem) => {
    await dispatch.systemConfigNotificationModel.deleteNotification(record.id)
  }, [dispatch])

  const handleTestSend = useCallback(async (record: INotificationListItem) => {
    await dispatch.systemConfigNotificationModel.testSend(record.id)
  }, [dispatch])

  const handleSubmit = useCallback(async (data: ICreateNotificationReq | IUpdateNotificationReq) => {
    if ('id' in data) {
      await dispatch.systemConfigNotificationModel.updateNotification(data as IUpdateNotificationReq)
    } else {
      await dispatch.systemConfigNotificationModel.createNotification(data as ICreateNotificationReq)
    }
  }, [dispatch])

  const handleRefresh = useCallback(() => {
    dispatch.systemConfigNotificationModel.getNotificationList()
  }, [dispatch])

  const columns: TableProps<INotificationListItem>['columns'] = useMemo(() => [
    {
      title: '通知名称',
      dataIndex: 'notificationName',
      width: 150,
      fixed: 'left',
    }, {
      title: '通知类型',
      dataIndex: 'notificationType',
      width: 100,
      render: (val: string) => typeMap[val] || val,
    }, {
      title: '接收人',
      dataIndex: 'recipients',
      width: 200,
    }, {
      title: '触发条件',
      dataIndex: 'triggerCondition',
      width: 200,
      render: (val: string) => val || '-',
    }, {
      title: '状态',
      dataIndex: 'isEnable',
      width: 80,
      render: (val: boolean) => (
        <Tag color={val ? 'success' : 'default'}>{val ? '启用' : '禁用'}</Tag>
      ),
    }, {
      title: '最后发送时间',
      dataIndex: 'lastSendTime',
      width: 180,
      render: (val: string) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-',
    }, {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 180,
      render: (val: string) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-',
    }, {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <a onClick={() => handleEdit(record)}>编辑</a>
          <a onClick={() => handleTestSend(record)}>测试发送</a>
          <Popconfirm title="确定要删除该通知配置吗？" onConfirm={() => handleDelete(record)} okText="确定" cancelText="取消">
            <a style={{ color: 'var(--px-color-error)' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleEdit, handleTestSend, handleDelete])

  return (
    <div className={styles.notification}>
      <PageHeader title="通知设置" onRefresh={handleRefresh} loading={loading.systemConfigNotificationModel?.getNotificationList} />
      <p className={styles.description}>
        管理系统通知配置，包括 Webhook、邮件、短信等通知方式的配置。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent<INotificationListItem>
        exButtons={(
          <Button type="primary" onClick={handleAdd}>
            新增通知配置
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        )}
        dataSource={notificationList}
        columns={columns}
        loading={loading.systemConfigNotificationModel?.getNotificationList}
        paginationData={pagination}
      />
      <NotificationEditPopup
        record={selectedRecord || undefined}
        open={editPopupOpen}
        onClose={() => { setEditPopupOpen(false); setSelectedRecord(null) }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

export default Notification
