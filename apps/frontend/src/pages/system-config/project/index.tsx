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
import { ICreateProjectReq, IProjectListItem, IProjectManageState, IUpdateProjectReq } from "./type"
import * as styles from "./styles.module.scss"
import ProjectEditPopup from "./components/EditPopup"
import PageHeader from "@components/PageHeader"

function Project() {
  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { projectList, pagination } = useModel<IProjectManageState>('systemConfigProjectModel')

  const [editPopupOpen, setEditPopupOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<IProjectListItem | null>(null)

  useHistoryListener((location) => {
    if (location.pathname === '/system-config/project') {
      dispatch.systemConfigProjectModel.getProjectList()
    }
  })

  const formItems: IFormItem[] = useMemo(() => [{
    key: 'projectName',
    label: '项目名称',
    type: FormItemType.TEXT,
  }, {
    key: 'projectKey',
    label: '项目标识',
    type: FormItemType.TEXT,
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

  const handleEdit = useCallback((record: IProjectListItem) => {
    setSelectedRecord(record)
    setEditPopupOpen(true)
  }, [])

  const handleDelete = useCallback(async (record: IProjectListItem) => {
    await dispatch.systemConfigProjectModel.deleteProject(record.id)
  }, [dispatch])

  const handleSubmit = useCallback(async (data: ICreateProjectReq | IUpdateProjectReq) => {
    if ('id' in data) {
      await dispatch.systemConfigProjectModel.updateProject(data as IUpdateProjectReq)
    } else {
      await dispatch.systemConfigProjectModel.createProject(data as ICreateProjectReq)
    }
  }, [dispatch])

  const handleRefresh = useCallback(() => {
    dispatch.systemConfigProjectModel.getProjectList()
  }, [dispatch])

  const columns: TableProps<IProjectListItem>['columns'] = useMemo(() => [
    {
      title: '项目名称',
      dataIndex: 'projectName',
      width: 150,
      fixed: 'left',
    }, {
      title: '项目标识',
      dataIndex: 'projectKey',
      width: 150,
    }, {
      title: '描述',
      dataIndex: 'description',
      width: 200,
      render: (val: string) => val || '-',
    }, {
      title: '成员数',
      dataIndex: 'memberCount',
      width: 80,
      render: (val: number) => val || 0,
    }, {
      title: '状态',
      dataIndex: 'isEnable',
      width: 80,
      render: (val: boolean) => (
        <Tag color={val ? 'success' : 'default'}>{val ? '启用' : '禁用'}</Tag>
      ),
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
          <Popconfirm title="确定要删除该项目吗？删除后关联数据将被清除。" onConfirm={() => handleDelete(record)} okText="确定" cancelText="取消">
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleEdit, handleDelete])

  return (
    <div className={styles.projectManage}>
      <PageHeader title="项目管理" onRefresh={handleRefresh} loading={loading.systemConfigProjectModel?.getProjectList} />
      <p className={styles.description}>
        管理系统中的项目，用于多租户数据隔离。每个项目的数据相互独立，用户可以属于多个项目。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent<IProjectListItem>
        exButtons={(
          <Button type="primary" onClick={handleAdd}>
            新增项目
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        )}
        dataSource={projectList}
        columns={columns}
        loading={loading.systemConfigProjectModel?.getProjectList}
        paginationData={pagination}
      />
      <ProjectEditPopup
        record={selectedRecord || undefined}
        open={editPopupOpen}
        onClose={() => { setEditPopupOpen(false); setSelectedRecord(null) }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

export default Project
