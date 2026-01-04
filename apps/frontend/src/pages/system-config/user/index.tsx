import React from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import { Button, Space, TableProps } from "antd"
import { AddOne } from "@icon-park/react"
import * as styles from "./styles.module.scss"

/**
 * 用户管理
 * 功能说明：管理系统用户账户，包括用户的创建、编辑、删除、启用/禁用等操作
 * 用途：用于管理系统的所有用户账户，分配用户角色，控制用户访问权限
 */
function UserManage() {

  const formItems: IFormItem[] = [{
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
      { label: '启用', value: true },
      { label: '禁用', value: false },
    ],
  }]

  const columns: TableProps<any>['columns'] = [
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
    }, {
      title: '状态',
      dataIndex: 'isActive',
      width: 100,
    }, {
      title: '最后登录时间',
      dataIndex: 'lastLogin',
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
          <a>分配角色</a>
          <a>重置密码</a>
          <a>删除</a>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles.userManage}>
      <h2>用户管理</h2>
      <p className={styles.description}>
        管理系统用户账户，包括用户的创建、编辑、删除、启用/禁用等操作。用于管理系统的所有用户账户，分配用户角色，控制用户访问权限。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent
        exButtons={(
          <Button type="primary">
            新增用户
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

export default UserManage

