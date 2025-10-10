import React, { useCallback, useEffect, useMemo } from "react"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { useHistoryListener, useModel, useQuery, useRouter } from "@/hooks"
import { IPointManageSpmState, ITrackingSpmListItem } from "@pages/point-manage/spm/type"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { Space, TableProps } from "antd"
import dayjs from "dayjs"

function ScmManage() {

  const {
    businessList,
    trackingSpmList,
    pageSize,
    page,
    total,
  } = useModel<IPointManageSpmState>('pointManageSpmModel')

  const { refresh } = useRouter()
  const query = useQuery()
  const dispatch = useDispatch<Dispatch>()

  useHistoryListener((location) => {
    if (location.pathname === '/point-manage/spm') {
      dispatch.pointManageSpmModel.init()
    }
  })

  useEffect(() => {
    if (!businessList.length) return
    if (query.businessCode) return
    refresh({ businessCode: businessList[0].code }, true)
  }, [businessList, query.businessCode, refresh])

  // 打开页面编辑弹窗
  const openPageEdit = useCallback((page?: ITrackingSpmListItem) => {
  }, [])

  // 打开模块编辑弹窗
  const openModuleEdit = useCallback((module: ITrackingSpmListItem | null, page?: ITrackingSpmListItem) => {
  }, [])

  // 打开点位编辑弹窗
  const openPointEdit = useCallback((module: ITrackingSpmListItem | null, point?: ITrackingSpmListItem) => {
  }, [])

  const formItems: IFormItem[] = [{
    label: '业务',
    key: 'businessCode',
    type: FormItemType.CASCADER,
    multiple: false,
    options: (businessList || []).map((item) => ({
      value: item.code,
      label: item.name,
    })),
  }]

  const columns = useMemo<TableProps<ITrackingSpmListItem>['columns']>(() => [{
    title: '编码',
    dataIndex: 'code',
    key: 'code',
    width: 100,
  }, {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    width: 100,
  }, {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
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
    width: 80,
    fixed: 'right',
    render: (text, record) => (
      <Space>
        <a onClick={() => openPageEdit(record)}>编辑页面</a>
        <a onClick={() => openModuleEdit(null, record)}>新增模块</a>
      </Space>
    ),
  }], [openModuleEdit, openPageEdit])

  return (
    <div>
      <h2>SPM管理</h2>
      <FormComponent
        formItems={formItems}
      />
      <TableComponent<ITrackingSpmListItem>
        dataSource={trackingSpmList}
        columns={columns}
        paginationData={{
          total,
          pageSize,
          current: page,
        }}
      />
    </div>
  )
}

export default ScmManage
