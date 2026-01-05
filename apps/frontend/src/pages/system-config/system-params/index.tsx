import React from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import { Button, Space, TableProps } from "antd"
import { AddOne } from "@icon-park/react"
import * as styles from "./styles.module.scss"

/**
 * 系统参数配置
 * 功能说明：管理系统级别的参数配置，包括系统参数的新增、编辑、删除和查看
 * 用途：用于配置系统运行的关键参数，如数据保留时间、采样率、缓存大小等全局设置
 */
function SystemParams() {

  const formItems: IFormItem[] = [{
    key: 'paramKey',
    label: '参数键',
    type: FormItemType.TEXT,
  }, {
    key: 'paramGroup',
    label: '参数分组',
    type: FormItemType.SELECT,
    options: [
      { label: '数据存储', value: 'storage' },
      { label: '数据处理', value: 'processing' },
      { label: '性能优化', value: 'performance' },
      { label: '安全设置', value: 'security' },
    ],
  }]

  const columns: TableProps<any>['columns'] = [
    {
      title: '参数键',
      dataIndex: 'paramKey',
      width: 200,
      fixed: 'left',
    }, {
      title: '参数值',
      dataIndex: 'paramValue',
      width: 250,
    }, {
      title: '参数分组',
      dataIndex: 'paramGroup',
      width: 120,
    }, {
      title: '参数描述',
      dataIndex: 'description',
      width: 300,
    }, {
      title: '是否可编辑',
      dataIndex: 'isEditable',
      width: 120,
    }, {
      title: '更新时间',
      dataIndex: 'updateTime',
      width: 180,
    }, {
      title: '更新人',
      dataIndex: 'updateUser',
      width: 120,
    }, {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: () => (
        <Space>
          <a>编辑</a>
          <a>详情</a>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles.systemParams}>
      <h2>系统参数配置</h2>
      <p className={styles.description}>
        管理系统级别的参数配置，包括系统参数的新增、编辑、删除和查看。用于配置系统运行的关键参数，如数据保留时间、采样率、缓存大小等全局设置。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent
        exButtons={(
          <Button type="primary">
            新增参数
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

export default SystemParams

