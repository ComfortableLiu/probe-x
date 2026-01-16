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
 * 数据源配置
 * 功能说明：管理系统数据源连接配置，包括数据库、Kafka、Redis等数据源的配置和管理
 * 用途：用于配置和管理系统所需的各种数据源连接，测试连接状态，监控数据源健康度
 */
function Datasource() {

  const formItems: IFormItem[] = [{
    key: 'datasourceName',
    label: '数据源名称',
    type: FormItemType.TEXT,
  }, {
    key: 'datasourceType',
    label: '数据源类型',
    type: FormItemType.SELECT,
    options: [
      { label: 'MySQL', value: 'mysql' },
      { label: 'Kafka', value: 'kafka' },
      { label: 'Redis', value: 'redis' },
      { label: 'MongoDB', value: 'mongodb' },
    ],
  }, {
    key: 'status',
    label: '连接状态',
    type: FormItemType.SELECT,
    options: [
      { label: '正常', value: 'normal' },
      { label: '异常', value: 'error' },
    ],
  }]

  const columns: TableProps<any>['columns'] = [
    {
      title: '数据源名称',
      dataIndex: 'datasourceName',
      width: 150,
      fixed: 'left',
    }, {
      title: '数据源类型',
      dataIndex: 'datasourceType',
      width: 120,
    }, {
      title: '连接地址',
      dataIndex: 'host',
      width: 200,
    }, {
      title: '端口',
      dataIndex: 'port',
      width: 80,
    }, {
      title: '数据库名',
      dataIndex: 'database',
      width: 150,
    }, {
      title: '连接状态',
      dataIndex: 'status',
      width: 100,
    }, {
      title: '最后检测时间',
      dataIndex: 'lastCheckTime',
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
          <a>测试连接</a>
          <a>详情</a>
          <a>删除</a>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles.datasource}>
      <PageHeader title="数据源配置" />
      <p className={styles.description}>
        管理系统数据源连接配置，包括数据库、Kafka、Redis等数据源的配置和管理。用于配置和管理系统所需的各种数据源连接，测试连接状态，监控数据源健康度。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent
        exButtons={(
          <Button type="primary">
            新增数据源
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

export default Datasource

