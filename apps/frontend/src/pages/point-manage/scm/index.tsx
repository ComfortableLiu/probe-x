import React, { useCallback, useMemo, useState } from "react"
import { useHistoryListener, useLoading, useModel } from "@/hooks"
import { IPointManageScmState, ITrackingScmListItem } from "@pages/point-manage/scm/type"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import SpmScmEditPopup from "@pages/point-manage/components/SpmScmEditPopup"
import { ICreateSpmNodeReq, IUpdateSpmNodeReq, TrackingNodeLevel } from "@probe-x/shared-types/src"
import A from "@pages/point-manage/scm/components/a"
import B from "@pages/point-manage/scm/components/b"
import C from "@pages/point-manage/scm/components/c"
import D from "@pages/point-manage/scm/components/d"
import { Splitter, Collapse } from "antd"
import { InfoCircleOutlined } from "@ant-design/icons"
import PageHeader from "@components/PageHeader"
import * as styles from "./styles.module.scss"

function ScmManage() {

  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()

  useHistoryListener((location) => {
    if (location.pathname === '/point-manage/scm') {
      dispatch.pointManageScmModel.init()
    }
  })

  const containerHeight = useMemo(() => {
    // 窗口高度 - 标题高度 - 提示框高度 - 内容边框 - 上下两个内边距 - 按钮高度 - 内容详情 - 内容详情上下边距 - 列表边框
    return window.innerHeight - 47 - 48 - 2 - 24 - 32 - 156 - 24 - 2
  }, [])

  const [showEditPopup, setShowEditPopup] = useState(false)
  const [editPopupInfo, setEditPopupInfo] = useState<{
    nodeName: string,
    nodeData?: ITrackingScmListItem,
    parentNodeName: string,
    parentNodeData?: ITrackingScmListItem
    level: TrackingNodeLevel
    handleSubmit: (value: ICreateSpmNodeReq | IUpdateSpmNodeReq) => void
  }>()

  const [selectedA, setSelectedA] = useState<ITrackingScmListItem>()
  const [selectedB, setSelectedB] = useState<ITrackingScmListItem>()
  const [selectedC, setSelectedC] = useState<ITrackingScmListItem>()
  const [selectedD, setSelectedD] = useState<ITrackingScmListItem>()

  const handleSubmit = useCallback(async (parentCode: string | null, value: ICreateSpmNodeReq | IUpdateSpmNodeReq) => {
    if ((value as IUpdateSpmNodeReq)?.code) {
      await dispatch.pointManageScmModel.updateScmNode(value as IUpdateSpmNodeReq)
    } else {
      await dispatch.pointManageScmModel.createScmNode(value as ICreateSpmNodeReq)
    }
    if (parentCode) {
      dispatch.pointManageScmModel.getScmNodeList({ parentCode })
    } else {
      dispatch.pointManageScmModel.getScmNodeList({ parentCode: null })
    }
  }, [dispatch.pointManageScmModel])

  // 打开A编辑弹窗
  const openAEdit = useCallback((a?: ITrackingScmListItem) => {
    setEditPopupInfo({
      nodeData: a,
      parentNodeData: undefined,
      nodeName: 'A（内容来源）',
      parentNodeName: '',
      level: TrackingNodeLevel.LEVEL1,
      handleSubmit: async (value) => handleSubmit(null, value),
    })
    setShowEditPopup(true)
  }, [handleSubmit])

  // 打开B编辑弹窗
  const openBEdit = useCallback((a: ITrackingScmListItem | null, b?: ITrackingScmListItem) => {
    setEditPopupInfo({
      nodeData: b,
      parentNodeData: a,
      nodeName: 'B（配置方式）',
      parentNodeName: 'A（内容来源）',
      level: TrackingNodeLevel.LEVEL2,
      handleSubmit: async (value) => handleSubmit(a?.code, value),
    })
    setShowEditPopup(true)
  }, [handleSubmit])

  // 打开C编辑弹窗
  const openCEdit = useCallback((b: ITrackingScmListItem | null, c?: ITrackingScmListItem) => {
    setEditPopupInfo({
      nodeData: c,
      parentNodeData: b,
      nodeName: 'C（内容类型）',
      parentNodeName: 'B（配置方式）',
      level: TrackingNodeLevel.LEVEL3,
      handleSubmit: async (value) => handleSubmit(b?.code, value),
    })
    setShowEditPopup(true)
  }, [handleSubmit])

  // 打开D编辑弹窗
  const openDEdit = useCallback((c: ITrackingScmListItem | null, d?: ITrackingScmListItem) => {
    setEditPopupInfo({
      nodeData: d,
      parentNodeData: c,
      nodeName: 'D（内容ID）',
      parentNodeName: 'C（内容类型）',
      level: TrackingNodeLevel.LEVEL4,
      handleSubmit: async (value) => handleSubmit(c?.code, value),
    })
    setShowEditPopup(true)
  }, [handleSubmit])

  // 关闭编辑弹窗
  const closeEditPopup = useCallback(() => {
    setEditPopupInfo(undefined)
    setShowEditPopup(false)
  }, [])

  const handleRefresh = useCallback(() => {
    dispatch.pointManageScmModel.getScmNodeList({ parentCode: null })
  }, [dispatch])

  return (
    <div className={styles.container}>
      <PageHeader
        title="SCM管理"
        onRefresh={handleRefresh}
        loading={loading.pointManageScmModel.getScmNodeList}
      />

      <Collapse
        ghost
        style={{ marginBottom: 12 }}
        items={[
          {
            key: '1',
            label: (
              <span>
                <InfoCircleOutlined style={{ marginRight: 8 }} />
                SCM说明
              </span>
            ),
            children: (
              <div style={{ paddingLeft: 24 }}>
                <p><strong>A（内容来源）</strong>：标识内容来源 ID，用来标识内容是从哪里来的，如：运营后台</p>
                <p><strong>B（配置方式）</strong>：标识配置方式 ID，用来标识是用什么方式进行配置的，如：人工配置、系统生成</p>
                <p><strong>C（内容类型）</strong>：标识内容类型 ID，用来标识内容的类型，如：跳转列表的图片、跳转活动的超链接</p>
                <p><strong>D（内容ID）</strong>：标识内容 ID，用来唯一标识当前的内容</p>
              </div>
            ),
          },
        ]}
      />

      <Splitter style={{ border: '1px solid #eee', height: "calc(100vh - 47px - 48px)" }}>
        <Splitter.Panel style={{ height: '100%' }}>
          <A
            containerHeight={containerHeight}
            selectedA={selectedA}
            openAAdd={() => openAEdit()}
            openAEdit={(a: ITrackingScmListItem) => openAEdit(a)}
            selectA={(a: ITrackingScmListItem) => {
              setSelectedA(a)
              setSelectedB(undefined)
              setSelectedC(undefined)
              setSelectedD(undefined)
            }}
          />
        </Splitter.Panel>
        <Splitter.Panel style={{ height: '100%' }}>
          <B
            containerHeight={containerHeight}
            selectedA={selectedA}
            selectedB={selectedB}
            openAEdit={(a) => openAEdit(a)}
            openBAdd={(a) => openBEdit(a)}
            openBEdit={(b: ITrackingScmListItem, a: ITrackingScmListItem) => openBEdit(a, b)}
            selectB={(b: ITrackingScmListItem) => {
              setSelectedB(b)
              setSelectedC(undefined)
              setSelectedD(undefined)
            }}
          />
        </Splitter.Panel>
        <Splitter.Panel style={{ height: '100%' }}>
          <C
            containerHeight={containerHeight}
            selectedA={selectedA}
            selectedB={selectedB}
            selectedC={selectedC}
            openBEdit={(b: ITrackingScmListItem, a: ITrackingScmListItem) => openBEdit(a, b)}
            openCAdd={(b) => openCEdit(b)}
            openCEdit={(c: ITrackingScmListItem, b: ITrackingScmListItem) => openCEdit(b, c)}
            selectC={(c: ITrackingScmListItem) => {
              setSelectedC(c)
              setSelectedD(undefined)
            }}
          />
        </Splitter.Panel>
        <Splitter.Panel style={{ height: '100%' }}>
          <D
            containerHeight={containerHeight}
            selectedA={selectedA}
            selectedB={selectedB}
            selectedC={selectedC}
            selectedD={selectedD}
            openCEdit={(c: ITrackingScmListItem, b: ITrackingScmListItem) => openCEdit(b, c)}
            openDAdd={(c) => openDEdit(c)}
            openDEdit={(d: ITrackingScmListItem, c: ITrackingScmListItem) => openDEdit(c, d)}
            selectD={(d: ITrackingScmListItem) => setSelectedD(d)}
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
        level={editPopupInfo?.level}
        onSubmit={async (value: ICreateSpmNodeReq | IUpdateSpmNodeReq) => editPopupInfo?.handleSubmit(value)}
        loading={loading.pointManageScmModel.updateScmNode || loading.pointManageScmModel.createScmNode}
      />
    </div>
  )
}

export default ScmManage
