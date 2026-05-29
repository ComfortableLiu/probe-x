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
 * 日志配置
 * 功能说明：管理系统日志配置，包括日志级别、日志存储、日志保留策略等配置
 * 用途：用于配置系统的日志记录规则，设置不同模块的日志级别，管理日志存储和清理策略
 */
function LogConfig() {

  const formItems: IFormItem[] = [{
    key: 'module',
    label: '模块',
    type: FormItemType.SELECT,
    options: [
      { label: '全部', value: 'all' },
      { label: 'API服务', value: 'api' },
      { label: '数据处理', value: 'processing' },
      { label: '数据接收', value: 'receiving' },
    ],
  }, {
    key: 'logLevel',
    label: '日志级别',
    type: FormItemType.SELECT,
    options: [
      { label: 'DEBUG', value: 'debug' },
      { label: 'INFO', value: 'info' },
      { label: 'WARN', value: 'warn' },
      { label: 'ERROR', value: 'error' },
    ],
  }]

  const columns: TableProps<any>['columns'] = [
    {
      title: '模块名称',
      dataIndex: 'module',
      width: 150,
      fixed: 'left',
    }, {
      title: '日志级别',
      dataIndex: 'logLevel',
      width: 120,
    }, {
      title: '日志存储路径',
      dataIndex: 'storagePath',
      width: 250,
    }, {
      title: '日志保留天数',
      dataIndex: 'retentionDays',
      width: 120,
    }, {
      title: '日志文件大小限制',
      dataIndex: 'maxFileSize',
      width: 150,
    }, {
      title: '是否启用',
      dataIndex: 'isEnable',
      width: 100,
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
    <div className={styles.logConfig}>
      <PageHeader title="日志配置" />
      <p className={styles.description}>
        管理系统日志配置，包括日志级别、日志存储、日志保留策略等配置。用于配置系统的日志记录规则，设置不同模块的日志级别，管理日志存储和清理策略。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent
        scroll={{ x: 'max-content' }}
        exButtons={(
          <Button type="primary">
            新增日志配置
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

export default LogConfig

