import React from "react"
import { FormItemType } from "@components/FormComponent/constants"
import { Space, TableProps } from "antd"
import { IFormItem } from "@components/FormComponent/type"
import { IMetaEvent } from "@probe-x/shared-types/src"
import dayjs from "dayjs"
import { Link } from "react-router"

export const formItems: IFormItem[] = [{
  key: 'eventName',
  label: '事件名',
  type: FormItemType.TEXT,
}, {
  key: 'status',
  label: '事件状态',
  type: FormItemType.TEXT,
  disabled: true,
}]

export const columns: TableProps<IMetaEvent>['columns'] = [{
  title: '事件名',
  dataIndex: 'eventName',
  width: 150,
  fixed: 'left',
}, {
  title: '事件别名',
  dataIndex: 'eventAliases',
  width: 150,
}, {
  title: '事件描述',
  dataIndex: 'eventRemark',
  width: 250,
}, {
  title: '创建人',
  dataIndex: 'createNickname',
  width: 150,
}, {
  title: '创建时间',
  dataIndex: 'createTime',
  width: 150,
  render: text => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
}, {
  title: '更新人',
  dataIndex: 'updateNickname',
  width: 150,
}, {
  title: '更新时间',
  dataIndex: 'updateTime',
  render: text => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
  width: 150,
}, {
  title: '操作',
  key: 'action',
  width: 150,
  fixed: 'right',
  render: (text, record) => (
    <Space>
      <Link to={`/point-manage/event/detail/${record.eventName}`}>查看详情</Link>
      <Link to={`/point-manage/event/detail/${record.eventName}`}>查看属性</Link>
    </Space>
  ),
}]
