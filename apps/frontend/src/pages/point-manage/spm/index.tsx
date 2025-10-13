import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import FormComponent from "@components/FormComponent"
import { useHistoryListener, useLoading, useModel, useQuery, useRouter } from "@/hooks"
import { IPointManageSpmState, ITrackingSpmListItem } from "@pages/point-manage/spm/type"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { Button, Space, TableProps } from "antd"
import { AddOne } from "@icon-park/react"
import SpmScmEditPopup from "@pages/point-manage/components/SpmScmEditPopup"
import { ICreateSpmNodeReq, IUpdateSpmNodeReq } from "@probe-x/shared-types/src"
import TableComponent from "@components/TableComponent"
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
    handleSubmit: (value: ICreateSpmNodeReq | IUpdateSpmNodeReq) => void
  }>()

  const handleSubmit = useCallback(async (parentCode: string, value: ICreateSpmNodeReq | IUpdateSpmNodeReq) => {
    if ((value as IUpdateSpmNodeReq)?.code) {
      await dispatch.pointManageSpmModel.updateSpmNode(value as IUpdateSpmNodeReq)
    } else {
      await dispatch.pointManageSpmModel.createSpmNode(value as ICreateSpmNodeReq)
    }
    dispatch.pointManageSpmModel.getSpmNodeList({ parentCode })
  }, [dispatch.pointManageSpmModel])

  // 打开页面编辑弹窗
  const openPageEdit = useCallback((_?, page?: ITrackingSpmListItem) => {
    setEditPopupInfo({
      nodeData: page,
      parentNodeData: businessData as ITrackingSpmListItem,
      nodeName: '页面',
      parentNodeName: '业务线',
      handleSubmit: async (value) => handleSubmit(null, value),
    })
    setShowEditPopup(true)
  }, [businessData, handleSubmit])

  // 打开模块编辑弹窗
  const openModuleEdit = useCallback((page: ITrackingSpmListItem | null, module?: ITrackingSpmListItem) => {
    setEditPopupInfo({
      nodeData: module,
      parentNodeData: page,
      nodeName: '模块',
      parentNodeName: '页面',
      handleSubmit: async (value) => handleSubmit(page?.code, value),
    })
    setShowEditPopup(true)
  }, [handleSubmit])

  // 打开点位编辑弹窗
  const openPointEdit = useCallback((module: ITrackingSpmListItem | null, point?: ITrackingSpmListItem) => {
    setEditPopupInfo({
      nodeData: point,
      parentNodeData: module,
      nodeName: '点位',
      parentNodeName: '模块',
      handleSubmit: async (value) => handleSubmit(module?.code, value),
    })
    setShowEditPopup(true)
  }, [handleSubmit])

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

  const columns = useCallback((openEdit, openChildEdit, parentNode): TableProps<ITrackingSpmListItem>['columns'] => {
    return [
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
        key: 'createNickname',
        width: 150,
      }, {
        title: '创建时间',
        dataIndex: 'createTime',
        key: 'createTime',
        width: 150,
        render: text => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
      }, {
        title: '更新人',
        dataIndex: 'updateNickname',
        key: 'updateNickname',
        width: 150,
      }, {
        title: '更新时间',
        dataIndex: 'updateTime',
        key: 'updateTime',
        render: text => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
        width: 150,
      }, {
        title: '操作',
        key: 'action',
        width: 80,
        fixed: 'right',
        render: (text, record) => (
          <Space wrap>
            <a onClick={() => openEdit(parentNode, record)}>编辑</a>
            {openChildEdit ? <a onClick={() => openChildEdit(record, null)}>新增</a> : null}
          </Space>
        ),
      },
    ]
  }, [])

  // 点位
  const renderPoint = useCallback((module: ITrackingSpmListItem) => {
    return (
      <Fragment>
        <Space style={{ margin: '8px 48px' }}>
          <Button
            type="primary"
            onClick={() => openPointEdit(module)}
          >
            新增点位
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        </Space>
        <TableComponent<ITrackingSpmListItem>
          dataSource={module?.child?.trackingSpmList || []}
          columns={columns(openPointEdit, null, module)}
          loading={loading.pointManageSpmModel.getSpmNodeList}
          style={{ padding: 0 }}
          paginationData={{
            total: module?.child?.total || 0,
            pageSize: module?.child?.pageSize || 20,
            current: module?.child?.page || 1,
          }}
          onPaginationChange={(pagination) => {
            dispatch.pointManageSpmModel.getSpmNodeList({
              parentCode: module?.code,
              page: pagination.current,
              pageSize: pagination.pageSize,
            })
          }}
        />
      </Fragment>
    )
  }, [columns, dispatch.pointManageSpmModel, loading.pointManageSpmModel.getSpmNodeList, openPointEdit])

  // 模块
  const renderModule = useCallback((pageInfo: ITrackingSpmListItem) => (
    <Fragment>
      <Space style={{ margin: '8px 48px' }}>
        <Button
          type="primary"
          onClick={() => openModuleEdit(pageInfo)}
        >
          新增模块
          <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
        </Button>
      </Space>
      <TableComponent<ITrackingSpmListItem>
        dataSource={pageInfo?.child?.trackingSpmList || []}
        columns={columns(openModuleEdit, openPointEdit, pageInfo)}
        loading={loading.pointManageSpmModel.getSpmNodeList}
        style={{ padding: 0 }}
        paginationData={{
          total: pageInfo?.child?.total || 0,
          pageSize: pageInfo?.child?.pageSize || 20,
          current: pageInfo?.child?.page || 1,
        }}
        expandable={{
          rowExpandable: (record) => record.childrenCount > 0,
          onExpand: (expanded, record) => {
            if (!expanded || record.child) return
            dispatch.pointManageSpmModel.getSpmNodeList({
              parentCode: record.code,
              page: 1,
              pageSize: 20,
            })
          },
          expandedRowRender: (record) => renderPoint(record),
        }}
        onPaginationChange={(pagination) => {
          dispatch.pointManageSpmModel.getSpmNodeList({
            parentCode: pageInfo?.code,
            page: pagination.current,
            pageSize: pagination.pageSize,
          })
        }}
      />
    </Fragment>
  ), [columns, dispatch.pointManageSpmModel, loading.pointManageSpmModel.getSpmNodeList, openModuleEdit, openPointEdit, renderPoint])

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
        dataSource={trackingSpmList || []}
        columns={columns(openPageEdit, openModuleEdit, null)}
        loading={loading.pointManageSpmModel.getSpmNodeList}
        style={{ padding: 0 }}
        paginationData={{
          total,
          pageSize,
          current: page,
        }}
        expandable={{
          rowExpandable: (record) => record.childrenCount > 0,
          onExpand: (expanded, record) => {
            if (!expanded || record.child) return
            dispatch.pointManageSpmModel.getSpmNodeList({
              parentCode: record.code,
              page: 1,
              pageSize: 20,
            })
          },
          expandedRowRender: (record) => renderModule(record),
        }}
      />
      <SpmScmEditPopup
        open={showEditPopup}
        onClose={closeEditPopup}
        selectedNodeData={editPopupInfo?.nodeData}
        nodeName={editPopupInfo?.nodeName}
        parentNode={editPopupInfo?.parentNodeData}
        parentNodeName={editPopupInfo?.parentNodeName}
        onSubmit={async (value: ICreateSpmNodeReq | IUpdateSpmNodeReq) => editPopupInfo?.handleSubmit(value)}
        loading={loading.pointManageSpmModel.updateSpmNode || loading.pointManageSpmModel.createSpmNode}
      />
    </div>
  )
}

export default ScmManage
