import React, { useCallback, useEffect, useMemo, useState } from "react"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import FormComponent from "@components/FormComponent"
import { useHistoryListener, useLoading, useModel, useQuery, useRouter } from "@/hooks"
import { IPointManageSpmState, ITrackingSpmListItem } from "@pages/point-manage/spm/type"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import SpmScmEditPopup from "@pages/point-manage/components/SpmScmEditPopup"
import { ICreateSpmNodeReq, IUpdateSpmNodeReq } from "@probe-x/shared-types/src"
import Page from "@pages/point-manage/spm/components/page"
import Module from "@pages/point-manage/spm/components/module"
import Point from "@pages/point-manage/spm/components/point"
import { Splitter } from "antd"

const CONTAINER_HEIGHT = 400

function ScmManage() {

  const {
    businessList,
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

  useEffect(() => {
    setSelectedPage(undefined)
    setSelectedModule(undefined)
    setSelectedPoint(undefined)
  }, [query.businessCode])

  const [showEditPopup, setShowEditPopup] = useState(false)
  const [editPopupInfo, setEditPopupInfo] = useState<{
    nodeName: string,
    nodeData?: ITrackingSpmListItem,
    parentNodeName: string,
    parentNodeData: ITrackingSpmListItem
    handleSubmit: (value: ICreateSpmNodeReq | IUpdateSpmNodeReq) => void
  }>()

  const [selectedPage, setSelectedPage] = useState<ITrackingSpmListItem>()
  const [selectedModule, setSelectedModule] = useState<ITrackingSpmListItem>()
  const [selectedPoint, setSelectedPoint] = useState<ITrackingSpmListItem>()

  const handleSubmit = useCallback(async (parentCode: string, value: ICreateSpmNodeReq | IUpdateSpmNodeReq) => {
    if ((value as IUpdateSpmNodeReq)?.code) {
      await dispatch.pointManageSpmModel.updateSpmNode(value as IUpdateSpmNodeReq)
    } else {
      await dispatch.pointManageSpmModel.createSpmNode(value as ICreateSpmNodeReq)
    }
    dispatch.pointManageSpmModel.getSpmNodeList({ parentCode })
  }, [dispatch.pointManageSpmModel])

  // 打开页面编辑弹窗
  const openPageEdit = useCallback((page?: ITrackingSpmListItem) => {
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

  return (
    <div>
      <h2>SPM管理</h2>
      <FormComponent
        formItems={formItems}
      />

      <Splitter style={{ border: '1px solid #eee' }}>
        <Splitter.Panel>
          <Page
            containerHeight={CONTAINER_HEIGHT}
            selectedPage={selectedPage}
            openPageAdd={() => openPageEdit()}
            openPageEdit={(page: ITrackingSpmListItem) => openPageEdit(page)}
            selectPage={(page: ITrackingSpmListItem) => {
              setSelectedPage(page)
              setSelectedModule(undefined)
              setSelectedPoint(undefined)
            }}
          />
        </Splitter.Panel>
        <Splitter.Panel>
          <Module
            containerHeight={CONTAINER_HEIGHT}
            selectedPage={selectedPage}
            selectedModule={selectedModule}
            openPageEdit={(page) => openPageEdit(page)}
            openModuleAdd={(page) => openModuleEdit(page)}
            openModuleEdit={(module: ITrackingSpmListItem, page: ITrackingSpmListItem) => openModuleEdit(page, module)}
            selectModule={(module: ITrackingSpmListItem) => {
              setSelectedModule(module)
              setSelectedPoint(undefined)
            }}
          />
        </Splitter.Panel>
        <Splitter.Panel>
          <Point
            containerHeight={CONTAINER_HEIGHT}
            selectedPage={selectedPage}
            selectedModule={selectedModule}
            selectedPoint={selectedPoint}
            openModuleEdit={(module: ITrackingSpmListItem, page: ITrackingSpmListItem) => openModuleEdit(page, module)}
            openPointAdd={(module) => openPointEdit(module)}
            openPointEdit={(point: ITrackingSpmListItem, module: ITrackingSpmListItem) => openPointEdit(module, point)}
            selectPoint={(point: ITrackingSpmListItem) => setSelectedPoint(point)}
          />
        </Splitter.Panel>
      </Splitter>

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
