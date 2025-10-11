import React, { useCallback, useEffect, useMemo, useState } from "react"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { useHistoryListener, useLoading, useModel, useQuery, useRouter } from "@/hooks"
import { IPointManageSpmState, ITrackingSpmListItem } from "@pages/point-manage/spm/type"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { Button, Space, TableProps } from "antd"
import dayjs from "dayjs"
import { AddOne } from "@icon-park/react"
import SpmScmEditPopup from "@pages/point-manage/components/SpmScmEditPopup"

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
  const loading = useLoading()

  useHistoryListener((location) => {
    if (location.pathname === '/point-manage/spm') {
      dispatch.pointManageSpmModel.init()
    }
  })

  const businessData = useMemo(() => {
    if (!businessList?.length) return null
    return businessList.find(data => data.code === query.businessCode)
  }, [businessList, query.businessCode])

  useEffect(() => {
    if (!businessList?.length) return
    if (query.businessCode) return
    refresh({ businessCode: businessList[0].code }, true)
  }, [businessList, query.businessCode, refresh])

  const [showEditPopup, setShowEditPopup] = useState(false)
  const [editPopupInfo, setEditPopupInfo] = useState<{
    nodeName: string,
    nodeData?: ITrackingSpmListItem,
    parentNodeName: string,
    parentNodeData: ITrackingSpmListItem
  }>()

  // 打开页面编辑弹窗
  const openPageEdit = useCallback((page?: ITrackingSpmListItem) => {
    console.log('lllllll-l=', businessData)
    setEditPopupInfo({
      nodeData: page,
      parentNodeData: businessData as ITrackingSpmListItem,
      nodeName: '页面',
      parentNodeName: '业务线',
    })
    setShowEditPopup(true)
  }, [businessData])

  // 打开模块编辑弹窗
  const openModuleEdit = useCallback((page: ITrackingSpmListItem | null, module?: ITrackingSpmListItem) => {
    setEditPopupInfo({
      nodeData: module,
      parentNodeData: page,
      nodeName: '模块',
      parentNodeName: '页面',
    })
    setShowEditPopup(true)
  }, [])

  // 打开点位编辑弹窗
  const openPointEdit = useCallback((module: ITrackingSpmListItem | null, point?: ITrackingSpmListItem) => {
    setEditPopupInfo({
      nodeData: point,
      parentNodeData: module,
      nodeName: '点位',
      parentNodeName: '模块',
    })
    setShowEditPopup(true)
  }, [])

  // 关闭编辑弹窗
  const closeEditPopup = useCallback(() => {
    setEditPopupInfo(undefined)
    setShowEditPopup(false)
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

  const columns = useMemo<TableProps<ITrackingSpmListItem>['columns']>(() => [
    {
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
    },
  ], [openModuleEdit, openPageEdit])

  return (
    <div>
      <h2>SPM管理</h2>
      <FormComponent
        formItems={formItems}
      />
      <Space style={{ margin: '8px 48px' }}>
        <Button
          type="primary"
          onClick={() => openPageEdit()}
        >
          新增页面
          <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
        </Button>
      </Space>
      <TableComponent<ITrackingSpmListItem>
        dataSource={trackingSpmList}
        columns={columns}
        paginationData={{
          total,
          pageSize,
          current: page,
        }}
      />
      <SpmScmEditPopup
        open={showEditPopup}
        onClose={closeEditPopup}
        selectedNodeData={editPopupInfo?.nodeData}
        nodeName={editPopupInfo?.nodeName}
        parentNode={editPopupInfo?.parentNodeData}
        parentNodeName={editPopupInfo?.parentNodeName}
        onSubmit={async (value) => {
        }}
      />
    </div>
  )
}

export default ScmManage
