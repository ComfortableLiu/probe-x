import React from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import { Button, Space, TableProps } from "antd"
import { AddOne } from "@icon-park/react"
import * as styles from "./styles.module.scss"
import PageHeader from "@components/PageHeader"

/**
 * 通知设置
 * 功能说明：管理系统通知配置，包括邮件、短信、站内信等通知方式的配置
 * 用途：用于配置系统的通知渠道和通知规则，设置告警阈值，管理通知模板
 */
function Notification() {

  const formItems: IFormItem[] = [{
    key: 'notificationName',
    label: '通知名称',
    type: FormItemType.TEXT,
  }, {
    key: 'notificationType',
    label: '通知类型',
    type: FormItemType.SELECT,
    options: [
      { label: '邮件', value: 'email' },
      { label: '短信', value: 'sms' },
      { label: '站内信', value: 'internal' },
      { label: 'Webhook', value: 'webhook' },
    ],
  }, {
    key: 'isEnable',
    label: '状态',
    type: FormItemType.SELECT,
    options: [
      { label: '启用', value: true },
      { label: '禁用', value: false },
    ],
  }]

  const columns: TableProps<any>['columns'] = [
    {
      title: '通知名称',
      dataIndex: 'notificationName',
      width: 150,
      fixed: 'left',
    }, {
      title: '通知类型',
      dataIndex: 'notificationType',
      width: 120,
    }, {
      title: '通知渠道',
      dataIndex: 'channel',
      width: 150,
    }, {
      title: '接收人',
      dataIndex: 'recipients',
      width: 200,
    }, {
      title: '触发条件',
      dataIndex: 'triggerCondition',
      width: 200,
    }, {
      title: '状态',
      dataIndex: 'isEnable',
      width: 100,
    }, {
      title: '最后发送时间',
      dataIndex: 'lastSendTime',
      width: 180,
    }, {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 180,
    }, {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: () => (
        <Space>
          <a>编辑</a>
          <a>测试发送</a>
          <a>删除</a>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles.notification}>
      <PageHeader title="通知设置" />
      <p className={styles.description}>
        管理系统通知配置，包括邮件、短信、站内信等通知方式的配置。用于配置系统的通知渠道和通知规则，设置告警阈值，管理通知模板。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent
        exButtons={(
          <Button type="primary">
            新增通知配置
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        )}
        dataSource={[]}
        columns={columns}
        loading={false}
      />
    </div>
  )
}

export default Notification

