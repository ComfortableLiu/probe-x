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
 * 计算节点配置
 * 功能说明：管理系统的计算节点，包括节点的添加、编辑、删除和状态监控
 * 用途：用于配置和管理数据处理的计算节点，监控节点运行状态，分配计算任务
 */
function ComputingNode() {

  const formItems: IFormItem[] = [{
    key: 'nodeName',
    label: '节点名称',
    type: FormItemType.TEXT,
  }, {
    key: 'status',
    label: '节点状态',
    type: FormItemType.SELECT,
    options: [
      { label: '运行中', value: 'running' },
      { label: '已停止', value: 'stopped' },
      { label: '异常', value: 'error' },
    ],
  }]

  const columns: TableProps<any>['columns'] = [
    {
      title: '节点名称',
      dataIndex: 'nodeName',
      width: 150,
    }, {
      title: '节点地址',
      dataIndex: 'nodeAddress',
      width: 200,
    }, {
      title: '节点类型',
      dataIndex: 'nodeType',
      width: 120,
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
    }, {
      title: 'CPU使用率',
      dataIndex: 'cpuUsage',
      width: 120,
    }, {
      title: '内存使用率',
      dataIndex: 'memoryUsage',
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
          <a>详情</a>
          <a>删除</a>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles.computingNode}>
      <PageHeader title="计算节点配置" />
      <p className={styles.description}>
        管理系统的计算节点，包括节点的添加、编辑、删除和状态监控。用于配置和管理数据处理的计算节点，监控节点运行状态，分配计算任务。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent
        exButtons={(
          <Button type="primary">
            新增节点
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

export default ComputingNode
