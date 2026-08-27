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
import { Splitter, Collapse } from "antd"
import { InfoCircleOutlined } from "@ant-design/icons"
import PageHeader from "@components/PageHeader"
import * as styles from "./styles.module.scss"

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

  const containerHeight = useMemo(() => {
    // 窗口高度 - form高度 - 标题高度 - 内容边框 - 上下两个内边距 - 按钮高度 - 内容详情 - 内容详情上下边距 - 列表边框
    return window.innerHeight - 150 - 47 - 2 - 24 - 32 - 156 - 24 - 2
  }, [])

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

  const handleRefresh = useCallback(() => {
    if (query.businessCode) {
      dispatch.pointManageSpmModel.getSpmNodeList({ parentCode: null })
    }
  }, [query.businessCode, dispatch])

  return (
    <div className={styles.container}>
      <PageHeader
        title="SPM管理"
        onRefresh={handleRefresh}
        loading={loading.pointManageSpmModel.getSpmNodeList}
      />
      <FormComponent formItems={formItems} />

      <Collapse
        ghost
        style={{ marginBottom: 12 }}
        items={[
          {
            key: '1',
            label: (
              <span>
                <InfoCircleOutlined style={{ marginRight: 8 }} />
                SPM说明
              </span>
            ),
            children: (
              <div style={{ paddingLeft: 24 }}>
                <p>SPM 用于唯一标识页面及模块，结构为 <strong>A.B.C.D</strong>：</p>
                <ul style={{ marginTop: 8, marginBottom: 16 }}>
                  <li><strong>A（站点/业务）</strong>：表示站点/业务，通常用作多地区（通常为多国家）运营，或多业务线，比如美国站、业务A</li>
                  <li><strong>B（页面）</strong>：表示页面，每个页面拥有唯一 Id，比如首页</li>
                  <li><strong>C（模块）</strong>：表示模块，同页面范围内，每一个模块都拥有唯一 Id，比如轮播图模块</li>
                  <li><strong>D（点位）</strong>：表示点位，一个模块内的点位 Id，比如轮播图模块中的第1张图</li>
                </ul>
                <p style={{ marginTop: 16, color: 'var(--px-color-text-secondary)' }}>
                  <strong>注意：</strong>站点/业务（A）不在这里维护，请在<strong>基础编码</strong>中进行维护。
                </p>
              </div>
            ),
          },
        ]}
      />

      <Splitter style={{ border: '1px solid var(--px-color-border-secondary)', height: "calc(100vh - 47px - 150px - 48px)" }}>
        <Splitter.Panel style={{ height: '100%' }}>
          <Page
            containerHeight={containerHeight}
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
        <Splitter.Panel style={{ height: '100%' }}>
          <Module
            containerHeight={containerHeight}
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
        <Splitter.Panel style={{ height: '100%' }}>
          <Point
            containerHeight={containerHeight}
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
