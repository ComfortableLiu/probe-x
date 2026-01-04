import React from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import { Button, Space, TableProps } from "antd"
import { AddOne } from "@icon-park/react"
import * as styles from "./styles.module.scss"

/**
 * 角色管理
 * 功能说明：管理系统角色，包括角色的创建、编辑、删除和权限分配
 * 用途：用于定义系统中的角色，为角色分配权限，实现基于角色的访问控制（RBAC）
 */
function RoleManage() {

  const formItems: IFormItem[] = [{
    key: 'roleName',
    label: '角色名称',
    type: FormItemType.TEXT,
  }, {
    key: 'roleKey',
    label: '角色标识',
    type: FormItemType.TEXT,
  }]

  const columns: TableProps<any>['columns'] = [
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
      title: '角色描述',
      dataIndex: 'description',
      width: 250,
    }, {
      title: '权限数量',
      dataIndex: 'permissionCount',
      width: 100,
    }, {
      title: '用户数量',
      dataIndex: 'userCount',
      width: 100,
    }, {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 180,
    }, {
      title: '更新时间',
      dataIndex: 'updateTime',
      width: 180,
    }, {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: () => (
        <Space>
          <a>编辑</a>
          <a>分配权限</a>
          <a>删除</a>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles.roleManage}>
      <h2>角色管理</h2>
      <p className={styles.description}>
        管理系统角色，包括角色的创建、编辑、删除和权限分配。用于定义系统中的角色，为角色分配权限，实现基于角色的访问控制（RBAC）。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent
        exButtons={(
          <Button type="primary">
            新增角色
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

export default RoleManage

