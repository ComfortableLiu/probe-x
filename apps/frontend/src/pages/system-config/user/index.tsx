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
import { IAssignRolesReq, ICreateUserReq, IResetPasswordReq, IUpdateUserReq, IUserListItem, IUserManageState } from "./type"
import * as styles from "./styles.module.scss"
import UserEditPopup from "./components/edit"
import AssignRolesPopup from "./components/assign-roles"
import ResetPasswordPopup from "./components/reset-password"
import PageHeader from "@components/PageHeader"

/**
 * 用户管理
 * 功能说明：管理系统用户账户，包括用户的创建、编辑、删除、启用/禁用等操作
 * 用途：用于管理系统的所有用户账户，分配用户角色，控制用户访问权限
 */
function UserManage() {
  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { userList, pagination } = useModel<IUserManageState>('systemConfigUserManageModel')

  const [editPopupOpen, setEditPopupOpen] = useState(false)
  const [assignRolesPopupOpen, setAssignRolesPopupOpen] = useState(false)
  const [resetPasswordPopupOpen, setResetPasswordPopupOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<IUserListItem | null>(null)

  useHistoryListener((location) => {
    const { pathname } = location
    if (pathname === '/system-config/user') {
      dispatch.systemConfigUserManageModel.getUserList()
      dispatch.systemConfigUserManageModel.getRoleList()
    }
  })

  const formItems: IFormItem[] = useMemo(() => [{
    key: 'username',
    label: '用户名',
    type: FormItemType.TEXT,
  }, {
    key: 'email',
    label: '邮箱',
    type: FormItemType.TEXT,
  }, {
    key: 'isActive',
    label: '状态',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: undefined },
      { label: '启用', value: true },
      { label: '禁用', value: false },
    ],
  }], [])

  const handleAddUser = useCallback(() => {
    setSelectedUser(null)
    setEditPopupOpen(true)
  }, [])

  const handleEditUser = useCallback((user: IUserListItem) => {
    setSelectedUser(user)
    setEditPopupOpen(true)
  }, [])

  const handleAssignRoles = useCallback((user: IUserListItem) => {
    setSelectedUser(user)
    setAssignRolesPopupOpen(true)
  }, [])

  const handleResetPassword = useCallback((user: IUserListItem) => {
    setSelectedUser(user)
    setResetPasswordPopupOpen(true)
  }, [])

  const handleDeleteUser = useCallback(async (user: IUserListItem) => {
    if (user.userId) {
      await dispatch.systemConfigUserManageModel.deleteUser(user.userId)
    }
  }, [dispatch])

  const handleEditSubmit = useCallback(async (data: ICreateUserReq | IUpdateUserReq) => {
    if ((data as IUpdateUserReq).userId) {
      await dispatch.systemConfigUserManageModel.updateUser(data as IUpdateUserReq)
    } else {
      await dispatch.systemConfigUserManageModel.createUser(data as ICreateUserReq)
    }
  }, [dispatch])

  const handleAssignRolesSubmit = useCallback(async (data: IAssignRolesReq) => {
    await dispatch.systemConfigUserManageModel.assignRoles(data)
  }, [dispatch])

  const handleResetPasswordSubmit = useCallback(async (data: IResetPasswordReq) => {
    await dispatch.systemConfigUserManageModel.resetPassword(data)
  }, [dispatch])

  const handleRefresh = useCallback(() => {
    dispatch.systemConfigUserManageModel.getUserList()
  }, [dispatch])

  const columns: TableProps<IUserListItem>['columns'] = useMemo(() => [
    {
      title: '用户名',
      dataIndex: 'username',
      width: 150,
      fixed: 'left',
    }, {
      title: '昵称',
      dataIndex: 'nickname',
      width: 150,
    }, {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
    }, {
      title: '角色',
      dataIndex: 'roles',
      width: 200,
      render: (roles: string[]) => {
        if (!roles || roles.length === 0) {
          return '-'
        }
        return (
          <Space wrap>
            {roles.map((role, index) => (
              <Tag key={index}>{role}</Tag>
            ))}
          </Space>
        )
      },
    }, {
      title: '状态',
      dataIndex: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive !== false ? 'success' : 'error'}>
          {isActive !== false ? '启用' : '禁用'}
        </Tag>
      ),
    }, {
      title: '最后登录时间',
      dataIndex: 'lastLogin',
      width: 180,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    }, {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 180,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    }, {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <a onClick={() => handleEditUser(record)}>编辑</a>
          <a onClick={() => handleAssignRoles(record)}>分配角色</a>
          <a onClick={() => handleResetPassword(record)}>重置密码</a>
          <Popconfirm
            title="确定要删除该用户吗？"
            onConfirm={() => handleDeleteUser(record)}
            okText="确定"
            cancelText="取消"
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleEditUser, handleAssignRoles, handleResetPassword, handleDeleteUser])

  return (
    <div className={styles.userManage}>
      <PageHeader
        title="用户管理"
        onRefresh={handleRefresh}
        loading={loading.systemConfigUserManageModel.getUserList}
      />
      <p className={styles.description}>
        管理系统用户账户，包括用户的创建、编辑、删除、启用/禁用等操作。用于管理系统的所有用户账户，分配用户角色，控制用户访问权限。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent<IUserListItem>
        exButtons={(
          <Button type="primary" onClick={handleAddUser}>
            新增用户
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        )}
        dataSource={userList}
        columns={columns}
        loading={loading.systemConfigUserManageModel.getUserList}
        paginationData={pagination}
      />
      <UserEditPopup
        user={selectedUser || undefined}
        open={editPopupOpen}
        onClose={() => {
          setEditPopupOpen(false)
          setSelectedUser(null)
        }}
        onSubmit={handleEditSubmit}
      />
      <AssignRolesPopup
        user={selectedUser || undefined}
        open={assignRolesPopupOpen}
        onClose={() => {
          setAssignRolesPopupOpen(false)
          setSelectedUser(null)
        }}
        onSubmit={handleAssignRolesSubmit}
      />
      <ResetPasswordPopup
        user={selectedUser || undefined}
        open={resetPasswordPopupOpen}
        onClose={() => {
          setResetPasswordPopupOpen(false)
          setSelectedUser(null)
        }}
        onSubmit={handleResetPasswordSubmit}
      />
    </div>
  )
}

export default UserManage

