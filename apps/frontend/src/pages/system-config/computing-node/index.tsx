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
import { IComputeNodeListItem, IComputeNodeManageState, ICreateComputeNodeReq, IUpdateComputeNodeReq } from "./type"
import * as styles from "./styles.module.scss"
import ComputeNodeEditPopup from "./components/EditPopup"
import PageHeader from "@components/PageHeader"

const statusMap: Record<string, { color: string; text: string }> = {
  running: { color: 'success', text: '运行中' },
  stopped: { color: 'default', text: '已停止' },
  error: { color: 'error', text: '异常' },
}

function ComputingNode() {
  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { nodeList, pagination } = useModel<IComputeNodeManageState>('systemConfigComputeNodeModel')

  const [editPopupOpen, setEditPopupOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<IComputeNodeListItem | null>(null)

  useHistoryListener((location) => {
    if (location.pathname === '/system-config/computing-node') {
      dispatch.systemConfigComputeNodeModel.getNodeList()
    }
  })

  const formItems: IFormItem[] = useMemo(() => [{
    key: 'nodeName',
    label: '节点名称',
    type: FormItemType.TEXT,
  }, {
    key: 'status',
    label: '节点状态',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: '运行中', value: 'running' },
      { label: '已停止', value: 'stopped' },
      { label: '异常', value: 'error' },
    ],
  }], [])

  const handleAdd = useCallback(() => {
    setSelectedRecord(null)
    setEditPopupOpen(true)
  }, [])

  const handleEdit = useCallback((record: IComputeNodeListItem) => {
    setSelectedRecord(record)
    setEditPopupOpen(true)
  }, [])

  const handleDelete = useCallback(async (record: IComputeNodeListItem) => {
    await dispatch.systemConfigComputeNodeModel.deleteNode(record.id)
  }, [dispatch])

  const handleSubmit = useCallback(async (data: ICreateComputeNodeReq | IUpdateComputeNodeReq) => {
    if ('id' in data) {
      await dispatch.systemConfigComputeNodeModel.updateNode(data as IUpdateComputeNodeReq)
    } else {
      await dispatch.systemConfigComputeNodeModel.createNode(data as ICreateComputeNodeReq)
    }
  }, [dispatch])

  const handleRefresh = useCallback(() => {
    dispatch.systemConfigComputeNodeModel.getNodeList()
  }, [dispatch])

  const columns: TableProps<IComputeNodeListItem>['columns'] = useMemo(() => [
    {
      title: '节点名称',
      dataIndex: 'nodeName',
      width: 150,
    }, {
      title: '节点地址',
      dataIndex: 'nodeAddress',
      width: 200,
      render: (val: string, record: IComputeNodeListItem) => `${val}:${record.nodePort}`,
    }, {
      title: '节点类型',
      dataIndex: 'nodeType',
      width: 100,
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => {
        const s = statusMap[val] || statusMap.stopped
        return <Tag color={s.color}>{s.text}</Tag>
      },
    }, {
      title: '权重',
      dataIndex: 'weight',
      width: 80,
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
          <Popconfirm title="确定要删除该节点吗？" onConfirm={() => handleDelete(record)} okText="确定" cancelText="取消">
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleEdit, handleDelete])

  return (
    <div className={styles.computingNode}>
      <PageHeader title="计算节点配置" onRefresh={handleRefresh} loading={loading.systemConfigComputeNodeModel?.getNodeList} />
      <p className={styles.description}>
        管理系统的计算节点，包括节点的添加、编辑、删除和状态监控。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent<IComputeNodeListItem>
        exButtons={(
          <Button type="primary" onClick={handleAdd}>
            新增节点
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        )}
        dataSource={nodeList}
        columns={columns}
        loading={loading.systemConfigComputeNodeModel?.getNodeList}
        paginationData={pagination}
      />
      <ComputeNodeEditPopup
        record={selectedRecord || undefined}
        open={editPopupOpen}
        onClose={() => { setEditPopupOpen(false); setSelectedRecord(null) }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

export default ComputingNode
