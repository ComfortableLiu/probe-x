import React, { useCallback, useMemo } from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import { TableProps, Tag } from "antd"
import dayjs from "dayjs"
import { useHistoryListener, useLoading, useModel } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { IAuditLogListItem, IAuditLogState } from "./type"
import * as styles from "./styles.module.scss"
import PageHeader from "@components/PageHeader"

const methodColors: Record<string, string> = {
  POST: 'blue',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple',
}

const actionMap: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  login: '登录',
  logout: '登出',
  test_send: '测试发送',
  test_connection: '测试连接',
  add_member: '添加成员',
  remove_member: '移除成员',
}

function AuditLog() {
  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { auditLogList, pagination } = useModel<IAuditLogState>('systemConfigAuditLogModel')

  useHistoryListener((location) => {
    if (location.pathname === '/system-config/audit-log') {
      dispatch.systemConfigAuditLogModel.getAuditLogList()
    }
  })

  const formItems: IFormItem[] = useMemo(() => [{
    key: 'username',
    label: '操作用户',
    type: FormItemType.TEXT,
  }, {
    key: 'action',
    label: '操作类型',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: '创建', value: 'create' },
      { label: '更新', value: 'update' },
      { label: '删除', value: 'delete' },
      { label: '登录', value: 'login' },
      { label: '测试发送', value: 'test_send' },
      { label: '测试连接', value: 'test_connection' },
    ],
  }, {
    key: 'method',
    label: '请求方法',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: 'POST', value: 'POST' },
      { label: 'PUT', value: 'PUT' },
      { label: 'DELETE', value: 'DELETE' },
    ],
  }], [])

  const handleRefresh = useCallback(() => {
    dispatch.systemConfigAuditLogModel.getAuditLogList()
  }, [dispatch])

  const columns: TableProps<IAuditLogListItem>['columns'] = useMemo(() => [
    {
      title: '操作用户',
      dataIndex: 'username',
      width: 120,
      fixed: 'left',
    }, {
      title: '操作类型',
      dataIndex: 'action',
      width: 100,
      render: (val: string) => actionMap[val] || val,
    }, {
      title: '请求方法',
      dataIndex: 'method',
      width: 90,
      render: (val: string) => <Tag color={methodColors[val] || 'default'}>{val}</Tag>,
    }, {
      title: '请求路径',
      dataIndex: 'path',
      width: 300,
      ellipsis: true,
    }, {
      title: '响应状态',
      dataIndex: 'responseStatus',
      width: 100,
      render: (val: number) => {
        if (!val) return '-'
        const color = val >= 200 && val < 300 ? 'success' : val >= 400 ? 'error' : 'warning'
        return <Tag color={color}>{val}</Tag>
      },
    }, {
      title: 'IP地址',
      dataIndex: 'ip',
      width: 140,
      render: (val: string) => val || '-',
    }, {
      title: '操作时间',
      dataIndex: 'createTime',
      width: 180,
      render: (val: string) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ], [])

  return (
    <div className={styles.auditLog}>
      <PageHeader title="审计日志" onRefresh={handleRefresh} loading={loading.systemConfigAuditLogModel?.getAuditLogList} />
      <p className={styles.description}>
        系统自动记录所有写操作的审计日志，包括创建、更新、删除等操作。支持按时间、用户、操作类型筛选。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent<IAuditLogListItem>
        dataSource={auditLogList}
        columns={columns}
        loading={loading.systemConfigAuditLogModel?.getAuditLogList}
        paginationData={pagination}
      />
    </div>
  )
}

export default AuditLog
