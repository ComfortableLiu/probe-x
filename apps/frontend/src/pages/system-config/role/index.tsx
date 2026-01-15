import React, { useCallback, useMemo, useState } from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import { Button, Popconfirm, Space, TableProps, Tag } from "antd"
import { AddOne, ViewList } from "@icon-park/react"
import { useNavigate } from "react-router-dom"
import dayjs from "dayjs"
import { useHistoryListener, useLoading, useModel } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { ICreateRoleReq, IUpdateRoleReq, IDeleteRoleReq, IAssignPermissionsReq, IRoleListItem, IRoleManageState } from "./type"
import { SystemRoleKey } from "@/constant/permissions"
import * as styles from "./styles.module.scss"
import RoleEditPopup from "./components/edit"
import AssignPermissionsPopup from "./components/assign-permissions"

/**
 * 角色管理
 * 功能说明：管理系统角色，包括角色的创建、编辑、删除和权限分配
 * 用途：用于定义系统中的角色，为角色分配权限，实现基于角色的访问控制（RBAC）
 */
function RoleManage() {
  const navigate = useNavigate()
  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { roleList, pagination } = useModel<IRoleManageState>('systemConfigRoleManageModel')

  const [editPopupOpen, setEditPopupOpen] = useState(false)
  const [assignPermissionsPopupOpen, setAssignPermissionsPopupOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<IRoleListItem | null>(null)

  useHistoryListener((location) => {
    const { pathname } = location
    if (pathname === '/system-config/role') {
      dispatch.systemConfigRoleManageModel.getRoleList()
    }
  })

  const formItems: IFormItem[] = useMemo(() => [{
    key: 'roleName',
    label: '角色名称',
    type: FormItemType.TEXT,
  }, {
    key: 'roleKey',
    label: '角色标识',
    type: FormItemType.TEXT,
  }, {
    key: 'isSystemRole',
    label: '角色类型',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: '' },
      { label: '系统角色', value: true },
      { label: '自定义角色', value: false },
    ],
  }], [])

  const handleAddRole = useCallback(() => {
    setSelectedRole(null)
    setEditPopupOpen(true)
  }, [])

  const handleEditRole = useCallback((role: IRoleListItem) => {
    setSelectedRole(role)
    setEditPopupOpen(true)
  }, [])

  const handleAssignPermissions = useCallback((role: IRoleListItem) => {
    setSelectedRole(role)
    setAssignPermissionsPopupOpen(true)
  }, [])

  const handleDeleteRole = useCallback(async (role: IRoleListItem) => {
    if (role.id) {
      await dispatch.systemConfigRoleManageModel.deleteRole({ id: role.id })
    }
  }, [dispatch])

  const handleEditSubmit = useCallback(async (data: ICreateRoleReq | IUpdateRoleReq) => {
    if ((data as IUpdateRoleReq).id) {
      await dispatch.systemConfigRoleManageModel.updateRole(data as IUpdateRoleReq)
    } else {
      await dispatch.systemConfigRoleManageModel.createRole(data as ICreateRoleReq)
    }
  }, [dispatch])

  const handleAssignPermissionsSubmit = useCallback(async (data: IAssignPermissionsReq) => {
    await dispatch.systemConfigRoleManageModel.assignPermissions(data)
  }, [dispatch])

  const canEdit = useCallback((role: IRoleListItem) => {
    if (role.isSystemRole) {
      // 系统角色中，超管不可编辑
      return role.roleKey !== SystemRoleKey.SUPER_ADMIN
    }
    return true
  }, [])

  const canDelete = useCallback((role: IRoleListItem) => {
    // 系统角色不可删除
    return !role.isSystemRole
  }, [])

  const handleViewPermissions = useCallback(() => {
    navigate('/system-config/permission-list')
  }, [navigate])

  const columns: TableProps<IRoleListItem>['columns'] = useMemo(() => [
    {
      title: '角色名称',
      dataIndex: 'roleName',
      width: 150,
      fixed: 'left',
    }, {
      title: '角色标识',
      dataIndex: 'roleKey',
      width: 150,
    }, {
      title: '角色类型',
      dataIndex: 'isSystemRole',
      width: 100,
      render: (isSystemRole: boolean) => (
        <Tag color={isSystemRole ? 'blue' : 'green'}>
          {isSystemRole ? '系统角色' : '自定义角色'}
        </Tag>
      ),
    }, {
      title: '角色描述',
      dataIndex: 'description',
      width: 250,
      ellipsis: true,
    }, {
      title: '权限数量',
      dataIndex: 'permissionCount',
      width: 100,
    }, {
      title: '用户数量',
      dataIndex: 'userCount',
      width: 100,
    }, {
      title: '状态',
      dataIndex: 'isEnable',
      width: 100,
      render: (isEnable: boolean) => (
        <Tag color={isEnable !== false ? 'success' : 'error'}>
          {isEnable !== false ? '启用' : '禁用'}
        </Tag>
      ),
    }, {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 180,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    }, {
      title: '更新时间',
      dataIndex: 'updateTime',
      width: 180,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    }, {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {canEdit(record) && (
            <a onClick={() => handleEditRole(record)}>编辑</a>
          )}
          <a onClick={() => handleAssignPermissions(record)}>分配权限</a>
          {canDelete(record) && (
            <Popconfirm
              title="确定要删除该角色吗？"
              onConfirm={() => handleDeleteRole(record)}
              okText="确定"
              cancelText="取消"
            >
              <a style={{ color: '#ff4d4f' }}>删除</a>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [handleEditRole, handleAssignPermissions, handleDeleteRole, canEdit, canDelete])

  return (
    <div className={styles.roleManage}>
      <h2>角色管理</h2>
      <p className={styles.description}>
        管理系统角色，包括角色的创建、编辑、删除和权限分配。用于定义系统中的角色，为角色分配权限，实现基于角色的访问控制（RBAC）。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent<IRoleListItem>
        exButtons={(
          <Space>
            <Button onClick={handleViewPermissions}>
              <ViewList style={{ display: "flex" }} theme="outline" size="14" />
              查看权限列表
            </Button>
            <Button type="primary" onClick={handleAddRole}>
              新增角色
              <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
            </Button>
          </Space>
        )}
        dataSource={roleList}
        columns={columns}
        loading={loading.systemConfigRoleManageModel.getRoleList}
        paginationData={pagination}
      />
      <RoleEditPopup
        role={selectedRole || undefined}
        open={editPopupOpen}
        onClose={() => {
          setEditPopupOpen(false)
          setSelectedRole(null)
        }}
        onSubmit={handleEditSubmit}
      />
      <AssignPermissionsPopup
        role={selectedRole || undefined}
        open={assignPermissionsPopupOpen}
        onClose={() => {
          setAssignPermissionsPopupOpen(false)
          setSelectedRole(null)
        }}
        onSubmit={handleAssignPermissionsSubmit}
      />
    </div>
  )
}

export default RoleManage
