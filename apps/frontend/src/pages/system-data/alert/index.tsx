import React, { useCallback, useEffect, useMemo, useState } from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import { Button, Popconfirm, Space, Switch, TableProps, Tag, Tabs } from "antd"
import { AddOne } from "@icon-park/react"
import dayjs from "dayjs"
import { useHistoryListener, useLoading, useModel } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import {
  IAlertRule,
  IAlertHistory,
  IAlertState,
  ICreateAlertRuleReq,
  IUpdateAlertRuleReq,
} from "./type"
import * as styles from "./styles.module.scss"
import RuleEditPopup from "./components/RuleEditPopup"
import PageHeader from "@components/PageHeader"

const levelColors: Record<string, string> = {
  info: 'blue',
  warning: 'warning',
  critical: 'error',
}

const levelMap: Record<string, string> = {
  info: '提示',
  warning: '警告',
  critical: '严重',
}

function Alert() {
  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { ruleList, rulePagination, historyList, historyPagination, activeTab } = useModel<IAlertState>('systemDataAlertModel')

  const [editPopupOpen, setEditPopupOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<IAlertRule | null>(null)

  useHistoryListener((location) => {
    if (location.pathname === '/system-data/alert') {
      dispatch.systemDataAlertModel.getAlertRuleList()
    }
  })

  useEffect(() => {
    if (activeTab === 'rules') {
      dispatch.systemDataAlertModel.getAlertRuleList()
    } else {
      dispatch.systemDataAlertModel.getAlertHistoryList()
    }
  }, [activeTab, dispatch])

  const ruleFormItems: IFormItem[] = useMemo(() => [{
    key: 'name',
    label: '规则名称',
    type: FormItemType.TEXT,
  }, {
    key: 'level',
    label: '告警级别',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: '提示', value: 'info' },
      { label: '警告', value: 'warning' },
      { label: '严重', value: 'critical' },
    ],
  }, {
    key: 'enabled',
    label: '状态',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: '启用', value: true },
      { label: '禁用', value: false },
    ],
  }], [])

  const historyFormItems: IFormItem[] = useMemo(() => [{
    key: 'level',
    label: '告警级别',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: '提示', value: 'info' },
      { label: '警告', value: 'warning' },
      { label: '严重', value: 'critical' },
    ],
  }], [])

  const handleAdd = useCallback(() => {
    setSelectedRecord(null)
    setEditPopupOpen(true)
  }, [])

  const handleEdit = useCallback((record: IAlertRule) => {
    setSelectedRecord(record)
    setEditPopupOpen(true)
  }, [])

  const handleDelete = useCallback(async (record: IAlertRule) => {
    await dispatch.systemDataAlertModel.deleteAlertRule(record.id)
  }, [dispatch])

  const handleToggle = useCallback(async (record: IAlertRule, enabled: boolean) => {
    await dispatch.systemDataAlertModel.toggleAlertRule({ id: record.id, enabled })
  }, [dispatch])

  const handleSubmit = useCallback(async (data: ICreateAlertRuleReq | IUpdateAlertRuleReq) => {
    if ('id' in data) {
      await dispatch.systemDataAlertModel.updateAlertRule(data as IUpdateAlertRuleReq)
    } else {
      await dispatch.systemDataAlertModel.createAlertRule(data as ICreateAlertRuleReq)
    }
  }, [dispatch])

  const handleRefresh = useCallback(() => {
    if (activeTab === 'rules') {
      dispatch.systemDataAlertModel.getAlertRuleList()
    } else {
      dispatch.systemDataAlertModel.getAlertHistoryList()
    }
  }, [dispatch, activeTab])

  const handleTabChange = useCallback((key: string) => {
    dispatch.systemDataAlertModel.updateItem({ activeTab: key as 'rules' | 'history' })
  }, [dispatch])

  const ruleColumns: TableProps<IAlertRule>['columns'] = useMemo(() => [
    {
      title: '规则名称',
      dataIndex: 'name',
      width: 180,
      fixed: 'left',
    }, {
      title: '监控事件',
      dataIndex: 'eventName',
      width: 160,
    }, {
      title: '触发条件',
      key: 'condition',
      width: 180,
      render: (_, record) => `${record.windowMinutes}分钟内次数 ${record.operator} ${record.threshold}`,
    }, {
      title: '巡检频率',
      dataIndex: 'checkIntervalMinutes',
      width: 100,
      render: (val: number) => `${val} 分钟`,
    }, {
      title: '告警级别',
      dataIndex: 'level',
      width: 100,
      render: (val: string) => <Tag color={levelColors[val] || 'default'}>{levelMap[val] || val}</Tag>,
    }, {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (val: boolean, record) => (
        <Switch
          checked={val}
          loading={loading.systemDataAlertModel?.toggleAlertRule}
          onChange={(checked) => handleToggle(record, checked)}
        />
      ),
    }, {
      title: '最后触发时间',
      dataIndex: 'lastTriggeredAt',
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
            <a style={{ color: 'var(--px-color-error)' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleEdit, handleDelete, handleToggle, loading])

  const historyColumns: TableProps<IAlertHistory>['columns'] = useMemo(() => [
    {
      title: '触发时间',
      dataIndex: 'createTime',
      width: 180,
      render: (val: string) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-',
    }, {
      title: '规则名称',
      dataIndex: 'ruleName',
      width: 180,
      render: (val: string) => val || '-',
    }, {
      title: '指标值',
      dataIndex: 'metricValue',
      width: 100,
    }, {
      title: '阈值',
      dataIndex: 'threshold',
      width: 100,
    }, {
      title: '告警级别',
      dataIndex: 'level',
      width: 100,
      render: (val: string) => <Tag color={levelColors[val] || 'default'}>{levelMap[val] || val}</Tag>,
    }, {
      title: 'Webhook 结果',
      dataIndex: 'webhookStatus',
      width: 120,
      render: (val: string) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          success: { text: '发送成功', color: 'success' },
          failed: { text: '发送失败', color: 'error' },
        }
        const s = statusMap[val] || { text: val, color: 'default' }
        return <Tag color={s.color}>{s.text}</Tag>
      },
    }, {
      title: '错误信息',
      dataIndex: 'error',
      width: 300,
      ellipsis: true,
      render: (val: string) => val || '-',
    },
  ], [])

  const tabItems = [
    {
      key: 'rules',
      label: '告警规则',
      children: (
        <>
          <FormComponent formItems={ruleFormItems} />
          <TableComponent<IAlertRule>
            exButtons={(
              <Button type="primary" onClick={handleAdd}>
                新增告警规则
                <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
              </Button>
            )}
            dataSource={ruleList}
            columns={ruleColumns}
            loading={loading.systemDataAlertModel?.getAlertRuleList}
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
          <TableComponent<IAlertHistory>
            dataSource={historyList}
            columns={historyColumns}
            loading={loading.systemDataAlertModel?.getAlertHistoryList}
            paginationData={historyPagination}
          />
        </>
      ),
    },
  ]

  return (
    <div className={styles.alertManage}>
      <PageHeader title="告警管理" onRefresh={handleRefresh} loading={loading.systemDataAlertModel?.getAlertRuleList || loading.systemDataAlertModel?.getAlertHistoryList} />
      <p className={styles.description}>
        配置阈值告警规则：当某事件在时间窗内的次数满足比较条件时，系统会自动调用 Webhook 发送告警通知并记录历史。
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
