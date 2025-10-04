import { FormItemType } from "@components/FormComponent/constants"
import { TableProps } from "antd"
import { IFormItem } from "@components/FormComponent/type"
import { IMetaEvent } from "@probe-x/shared-types/src"

export const formItems: IFormItem[] = [{
  key: 'eventName',
  label: '事件名',
  type: FormItemType.TEXT,
}, {
  key: 'status',
  label: '事件状态',
  type: FormItemType.TEXT,
}]

export const columns: TableProps<IMetaEvent>['columns'] = [{
  title: '事件名',
  dataIndex: 'eventName',
  key: 'eventName',
}, {
  title: '事件别名',
  dataIndex: 'eventAliases',
  key: 'eventAliases',
}, {
  title: '事件描述',
  dataIndex: 'eventRemark',
  key: 'eventRemark',
}, {
  title: '创建时间',
  dataIndex: 'creatTime',
  key: 'creatTime',
}, {
  title: '更新时间',
  dataIndex: 'updateTime',
}, {
  title: '操作',
  key: 'action',
}]
