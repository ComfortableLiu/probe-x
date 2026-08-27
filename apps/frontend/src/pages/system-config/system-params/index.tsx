import React from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import { TableProps, Tag } from "antd"
import * as styles from "./styles.module.scss"
import PageHeader from "@components/PageHeader"

/**
 * 系统参数配置
 * 功能说明：管理系统级别的参数配置，包括系统参数的新增、编辑、删除和查看
 * 用途：用于配置系统运行的关键参数，如数据保留时间、采样率、缓存大小等全局设置
 *
 * TODO: 后端系统参数接口尚未实现，当前页面仅为占位（列表数据为空，不提供新增/编辑入口），
 * 待接口就绪后补齐数据源与操作按钮
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
    },
  ]

  return (
    <div className={styles.systemParams}>
      <PageHeader
        title="系统参数配置"
        extra={<Tag color="warning">功能建设中</Tag>}
      />
      <p className={styles.description}>
        管理系统级别的参数配置，包括系统参数的新增、编辑、删除和查看。用于配置系统运行的关键参数，如数据保留时间、采样率、缓存大小等全局设置。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent
        scroll={{ x: 'max-content' }}
        dataSource={[]}
        columns={columns}
        loading={false}
      />
    </div>
  )
}

export default SystemParams

