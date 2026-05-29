import React, { useCallback, useEffect, useMemo, useState } from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import { Button, Popconfirm, Space, TableProps, Tag, Tabs } from "antd"
import { AddOne } from "@icon-park/react"
import dayjs from "dayjs"
import { useHistoryListener, useLoading, useModel } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import {
  IAlertRuleListItem,
  IAlertHistoryListItem,
  IAlertRuleState,
  ICreateAlertRuleReq,
  IUpdateAlertRuleReq,
} from "./type"
import * as styles from "./styles.module.scss"
import RuleEditPopup from "./components/RuleEditPopup"
import PageHeader from "@components/PageHeader"

const ruleTypeMap: Record<string, string> = {
  event_count_spike: '事件量异常波动',
  funnel_conversion_drop: '漏斗转化率下降',
  custom: '自定义规则',
}

const levelColors: Record<string, string> = {
  warning: 'warning',
  critical: 'error',
}

const levelMap: Record<string, string> = {
  warning: '警告',
  critical: '严重',
}

function Alert() {
  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { ruleList, rulePagination, historyList, historyPagination, activeTab } = useModel<IAlertRuleState>('systemConfigAlertModel')

  const [editPopupOpen, setEditPopupOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<IAlertRuleListItem | null>(null)

  useHistoryListener((location) => {
    if (location.pathname === '/system-config/alert') {
      dispatch.systemConfigAlertModel.getAlertRuleList()
    }
  })

  useEffect(() => {
    if (activeTab === 'rules') {
      dispatch.systemConfigAlertModel.getAlertRuleList()
    } else {
      dispatch.systemConfigAlertModel.getAlertHistoryList()
    }
  }, [activeTab, dispatch])

  const ruleFormItems: IFormItem[] = useMemo(() => [{
    key: 'ruleName',
    label: '规则名称',
    type: FormItemType.TEXT,
  }, {
    key: 'ruleType',
    label: '规则类型',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: '事件量异常波动', value: 'event_count_spike' },
      { label: '漏斗转化率下降', value: 'funnel_conversion_drop' },
      { label: '自定义规则', value: 'custom' },
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

  const historyFormItems: IFormItem[] = useMemo(() => [{
    key: 'alertLevel',
    label: '告警级别',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: '警告', value: 'warning' },
      { label: '严重', value: 'critical' },
    ],
  }], [])

  const handleAdd = useCallback(() => {
    setSelectedRecord(null)
    setEditPopupOpen(true)
  }, [])

  const handleEdit = useCallback((record: IAlertRuleListItem) => {
    setSelectedRecord(record)
    setEditPopupOpen(true)
  }, [])

  const handleDelete = useCallback(async (record: IAlertRuleListItem) => {
    await dispatch.systemConfigAlertModel.deleteAlertRule(record.id)
  }, [dispatch])

  const handleSubmit = useCallback(async (data: ICreateAlertRuleReq | IUpdateAlertRuleReq) => {
    if ('id' in data) {
      await dispatch.systemConfigAlertModel.updateAlertRule(data as IUpdateAlertRuleReq)
    } else {
      await dispatch.systemConfigAlertModel.createAlertRule(data as ICreateAlertRuleReq)
    }
  }, [dispatch])

  const handleRefresh = useCallback(() => {
    if (activeTab === 'rules') {
      dispatch.systemConfigAlertModel.getAlertRuleList()
    } else {
      dispatch.systemConfigAlertModel.getAlertHistoryList()
    }
  }, [dispatch, activeTab])

  const handleTabChange = useCallback((key: string) => {
    dispatch.systemConfigAlertModel.updateItem({ activeTab: key as 'rules' | 'history' })
  }, [dispatch])

  const ruleColumns: TableProps<IAlertRuleListItem>['columns'] = useMemo(() => [
    {
      title: '规则名称',
      dataIndex: 'ruleName',
      width: 180,
      fixed: 'left',
    }, {
      title: '规则类型',
      dataIndex: 'ruleType',
      width: 150,
      render: (val: string) => ruleTypeMap[val] || val,
    }, {
      title: '通知配置',
      dataIndex: 'notificationName',
      width: 120,
      render: (val: string) => val || '-',
    }, {
      title: '状态',
      dataIndex: 'isEnable',
      width: 80,
      render: (val: boolean) => (
        <Tag color={val ? 'success' : 'default'}>{val ? '启用' : '禁用'}</Tag>
      ),
    }, {
      title: '最后触发时间',
      dataIndex: 'lastTriggerTime',
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
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <a onClick={() => handleEdit(record)}>编辑</a>
          <Popconfirm title="确定要删除该告警规则吗？" onConfirm={() => handleDelete(record)} okText="确定" cancelText="取消">
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleEdit, handleDelete])

  const historyColumns: TableProps<IAlertHistoryListItem>['columns'] = useMemo(() => [
    {
      title: '规则名称',
      dataIndex: 'ruleName',
      width: 180,
    }, {
      title: '告警级别',
      dataIndex: 'alertLevel',
      width: 100,
      render: (val: string) => <Tag color={levelColors[val] || 'default'}>{levelMap[val] || val}</Tag>,
    }, {
      title: '告警内容',
      dataIndex: 'alertContent',
      width: 400,
      ellipsis: true,
    }, {
      title: '通知状态',
      dataIndex: 'notifyStatus',
      width: 100,
      render: (val: string) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          pending: { text: '待发送', color: 'default' },
          sent: { text: '已发送', color: 'success' },
          failed: { text: '发送失败', color: 'error' },
        }
        const s = statusMap[val] || { text: val, color: 'default' }
        return <Tag color={s.color}>{s.text}</Tag>
      },
    }, {
      title: '触发时间',
      dataIndex: 'createTime',
      width: 180,
      render: (val: string) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ], [])

  const tabItems = [
    {
      key: 'rules',
      label: '告警规则',
      children: (
        <>
          <FormComponent formItems={ruleFormItems} />
          <TableComponent<IAlertRuleListItem>
            exButtons={(
              <Button type="primary" onClick={handleAdd}>
                新增告警规则
                <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
              </Button>
            )}
            dataSource={ruleList}
            columns={ruleColumns}
            loading={loading.systemConfigAlertModel?.getAlertRuleList}
            paginationData={rulePagination}
          />
        </>
      ),
    },
    {
      key: 'history',
      label: '告警历史',
      children: (
        <>
          <FormComponent formItems={historyFormItems} />
          <TableComponent<IAlertHistoryListItem>
            dataSource={historyList}
            columns={historyColumns}
            loading={loading.systemConfigAlertModel?.getAlertHistoryList}
            paginationData={historyPagination}
          />
        </>
      ),
    },
  ]

  return (
    <div className={styles.alertManage}>
      <PageHeader title="告警管理" onRefresh={handleRefresh} loading={loading.systemConfigAlertModel?.getAlertRuleList || loading.systemConfigAlertModel?.getAlertHistoryList} />
      <p className={styles.description}>
        配置告警规则，系统会在满足条件时自动发送告警通知。支持事件量异常波动、漏斗转化率下降等多种规则类型。
      </p>
      <div className={styles.tabContent}>
        <Tabs items={tabItems} activeKey={activeTab} onChange={handleTabChange} />
      </div>
      <RuleEditPopup
        record={selectedRecord || undefined}
        open={editPopupOpen}
        onClose={() => { setEditPopupOpen(false); setSelectedRecord(null) }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

export default Alert
