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
import { ICreateDataSourceReq, IDataSourceListItem, IDataSourceManageState, IUpdateDataSourceReq } from "./type"
import * as styles from "./styles.module.scss"
import DataSourceEditPopup from "./components/EditPopup"
import PageHeader from "@components/PageHeader"

const statusMap: Record<string, { color: string; text: string }> = {
  normal: { color: 'success', text: '正常' },
  error: { color: 'error', text: '异常' },
  unchecked: { color: 'default', text: '未检测' },
}

const typeMap: Record<string, string> = {
  clickhouse: 'ClickHouse',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
}

function Datasource() {
  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { dataSourceList, pagination } = useModel<IDataSourceManageState>('systemConfigDataSourceModel')

  const [editPopupOpen, setEditPopupOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<IDataSourceListItem | null>(null)

  useHistoryListener((location) => {
    if (location.pathname === '/system-config/datasource') {
      dispatch.systemConfigDataSourceModel.getDataSourceList()
    }
  })

  const formItems: IFormItem[] = useMemo(() => [{
    key: 'datasourceName',
    label: '数据源名称',
    type: FormItemType.TEXT,
  }, {
    key: 'datasourceType',
    label: '数据源类型',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: 'ClickHouse', value: 'clickhouse' },
      { label: 'MySQL', value: 'mysql' },
      { label: 'PostgreSQL', value: 'postgresql' },
    ],
  }], [])

  const handleAdd = useCallback(() => {
    setSelectedRecord(null)
    setEditPopupOpen(true)
  }, [])

  const handleEdit = useCallback((record: IDataSourceListItem) => {
    setSelectedRecord(record)
    setEditPopupOpen(true)
  }, [])

  const handleDelete = useCallback(async (record: IDataSourceListItem) => {
    await dispatch.systemConfigDataSourceModel.deleteDataSource(record.id)
  }, [dispatch])

  const handleTestConnection = useCallback(async (record: IDataSourceListItem) => {
    await dispatch.systemConfigDataSourceModel.testConnection(record.id)
  }, [dispatch])

  const handleSubmit = useCallback(async (data: ICreateDataSourceReq | IUpdateDataSourceReq) => {
    if ('id' in data) {
      await dispatch.systemConfigDataSourceModel.updateDataSource(data as IUpdateDataSourceReq)
    } else {
      await dispatch.systemConfigDataSourceModel.createDataSource(data as ICreateDataSourceReq)
    }
  }, [dispatch])

  const handleRefresh = useCallback(() => {
    dispatch.systemConfigDataSourceModel.getDataSourceList()
  }, [dispatch])

  const columns: TableProps<IDataSourceListItem>['columns'] = useMemo(() => [
    {
      title: '数据源名称',
      dataIndex: 'datasourceName',
      width: 150,
      fixed: 'left',
    }, {
      title: '数据源类型',
      dataIndex: 'datasourceType',
      width: 120,
      render: (val: string) => typeMap[val] || val,
    }, {
      title: '连接地址',
      dataIndex: 'host',
      width: 200,
    }, {
      title: '端口',
      dataIndex: 'port',
      width: 80,
    }, {
      title: '数据库名',
      dataIndex: 'database',
      width: 150,
    }, {
      title: '连接状态',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => {
        const s = statusMap[val] || statusMap.unchecked
        return <Tag color={s.color}>{s.text}</Tag>
      },
    }, {
      title: '最后检测时间',
      dataIndex: 'lastCheckTime',
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
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <a onClick={() => handleEdit(record)}>编辑</a>
          <a onClick={() => handleTestConnection(record)}>测试连接</a>
          <Popconfirm title="确定要删除该数据源吗？" onConfirm={() => handleDelete(record)} okText="确定" cancelText="取消">
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleEdit, handleTestConnection, handleDelete])

  return (
    <div className={styles.datasource}>
      <PageHeader title="数据源配置" onRefresh={handleRefresh} loading={loading.systemConfigDataSourceModel?.getDataSourceList} />
      <p className={styles.description}>
        管理系统数据源连接配置，包括 ClickHouse、MySQL、PostgreSQL 等数据源的配置和管理。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent<IDataSourceListItem>
        exButtons={(
          <Button type="primary" onClick={handleAdd}>
            新增数据源
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        )}
        dataSource={dataSourceList}
        columns={columns}
        loading={loading.systemConfigDataSourceModel?.getDataSourceList}
        paginationData={pagination}
      />
      <DataSourceEditPopup
        record={selectedRecord || undefined}
        open={editPopupOpen}
        onClose={() => { setEditPopupOpen(false); setSelectedRecord(null) }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

export default Datasource
