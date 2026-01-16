import React from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import { Button, Space, TableProps } from "antd"
import { AddOne } from "@icon-park/react"
import * as styles from "./styles.module.scss"
import PageHeader from "@components/PageHeader"

/**
 * 权限管理
 * 功能说明：管理系统权限，包括权限的创建、编辑、删除和启用/禁用
 * 用途：用于定义系统中的所有权限点，控制用户和角色可以访问的功能和资源
 */
function PermissionManage() {

  const formItems: IFormItem[] = [{
    key: 'permissionName',
    label: '权限名称',
    type: FormItemType.TEXT,
  }, {
    key: 'permissionKey',
    label: '权限标识',
    type: FormItemType.TEXT,
  }, {
    key: 'isEnable',
    label: '状态',
    type: FormItemType.SELECT,
    options: [
      { label: '启用', value: true },
      { label: '禁用', value: false },
    ],
  }]

  const columns: TableProps<any>['columns'] = [
    {
      title: '权限名称',
      dataIndex: 'permissionName',
      width: 200,
      fixed: 'left',
    }, {
      title: '权限标识',
      dataIndex: 'permissionKey',
      width: 200,
    }, {
      title: '权限描述',
      dataIndex: 'description',
      width: 250,
    }, {
      title: '权限类型',
      dataIndex: 'permissionType',
      width: 120,
    }, {
      title: '状态',
      dataIndex: 'isEnable',
      width: 100,
    }, {
      title: '关联角色数',
      dataIndex: 'roleCount',
      width: 120,
    }, {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 180,
    }, {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: () => (
        <Space>
          <a>编辑</a>
          <a>删除</a>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles.permissionManage}>
      <PageHeader title="权限管理" />
      <p className={styles.description}>
        管理系统权限，包括权限的创建、编辑、删除和启用/禁用。用于定义系统中的所有权限点，控制用户和角色可以访问的功能和资源。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent
        exButtons={(
          <Button type="primary">
            新增权限
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

export default PermissionManage

