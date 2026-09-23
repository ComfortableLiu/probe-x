import React, { useCallback, useMemo, useRef, useState } from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import { Button, Popconfirm, Space, TableProps, Tabs, Tag, Tooltip } from "antd"
import dayjs from "dayjs"
import { useHistoryListener, useLoading, useModel } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import PageHeader from "@components/PageHeader"
import {
  IUtmItem,
  IUpdateUtmReq,
  UtmDimension,
  UTM_DIMENSION_LABEL,
  UTM_DIMENSION_OPTION_LABEL,
  UTM_DIMENSIONS,
} from "@probe-x/shared-types/src"
import { IPointManageUtmState, IUtmTab } from "@pages/point-manage/utm/type"
import EditPopup from "@pages/point-manage/utm/components/EditPopup"
import * as styles from "./styles.module.scss"

const DATE_FORMAT = "YYYY-MM-DD"
const DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss"

function UtmManage() {

  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { utmList, pagination, cursor } = useModel<IPointManageUtmState>("pointManageUtmModel")

  const [activeTab, setActiveTab] = useState<IUtmTab>("active")
  // 供 useHistoryListener 读取当前视图，避免闭包拿到旧值
  const activeTabRef = useRef<IUtmTab>("active")

  const [editPopupOpen, setEditPopupOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<IUtmItem | null>(null)

  useHistoryListener((location) => {
    if (location.pathname === "/point-manage/utm") {
      dispatch.pointManageUtmModel.getUtmList({ isDeleted: activeTabRef.current === "deleted" })
      dispatch.pointManageUtmModel.getCursor()
    }
  })

  const isDeleted = activeTab === "deleted"

  const formItems: IFormItem[] = useMemo(() => [{
    key: "dimension",
    label: "维度",
    type: FormItemType.SELECT,
    options: [
      { label: "全部", value: undefined },
      ...UTM_DIMENSIONS.map((dimension) => ({
        label: UTM_DIMENSION_OPTION_LABEL[dimension],
        value: dimension,
      })),
    ],
  }, {
    key: "value",
    label: "取值",
    type: FormItemType.TEXT,
    placeholder: "模糊匹配 UTM 原始取值",
  }, {
    key: "alias",
    label: "别名",
    type: FormItemType.TEXT,
    placeholder: "模糊匹配别名",
  }], [])

  const handleEdit = useCallback((record: IUtmItem) => {
    setSelectedRecord(record)
    setEditPopupOpen(true)
  }, [])

  const handleSubmitEdit = useCallback(async (data: IUpdateUtmReq & { isDeleted?: boolean }) => {
    await dispatch.pointManageUtmModel.updateUtm(data)
  }, [dispatch])

  const closeEditPopup = useCallback(() => {
    setEditPopupOpen(false)
    setSelectedRecord(null)
  }, [])

  const handleDelete = useCallback((record: IUtmItem) => {
    dispatch.pointManageUtmModel.deleteUtm({ id: record.id, isDeleted })
  }, [dispatch, isDeleted])

  const handleRestore = useCallback((record: IUtmItem) => {
    dispatch.pointManageUtmModel.restoreUtm({ id: record.id, isDeleted })
  }, [dispatch, isDeleted])

  const handleRecalc = useCallback((record: IUtmItem) => {
    dispatch.pointManageUtmModel.recalcUtm({ id: record.id, isDeleted })
  }, [dispatch, isDeleted])

  const handleSync = useCallback(() => {
    dispatch.pointManageUtmModel.syncStat({ isDeleted })
  }, [dispatch, isDeleted])

  const handleRefresh = useCallback(() => {
    dispatch.pointManageUtmModel.getUtmList({ isDeleted })
    dispatch.pointManageUtmModel.getCursor()
  }, [dispatch, isDeleted])

  const handleTabChange = useCallback((key: string) => {
    const tab = key as IUtmTab
    activeTabRef.current = tab
    setActiveTab(tab)
    dispatch.pointManageUtmModel.getUtmList({ isDeleted: tab === "deleted" })
  }, [dispatch])

  const columns: TableProps<IUtmItem>["columns"] = useMemo(() => [
    {
      title: "维度",
      dataIndex: "dimension",
      width: 100,
      fixed: "left",
      // 默认展示英文取值，中文名放 hover，跟「取值」列一样是机器可读的原文
      render: (value: UtmDimension) => (
        <Tooltip title={UTM_DIMENSION_LABEL[value] || value}>
          <Tag>{value}</Tag>
        </Tooltip>
      ),
    }, {
      title: "取值",
      dataIndex: "value",
      width: 220,
      fixed: "left",
      render: (text: string) => <span className={styles.valueCell}>{text}</span>,
    }, {
      title: "别名",
      dataIndex: "alias",
      width: 180,
      ellipsis: true,
      render: (text: string) => text || "-",
    }, {
      title: "描述",
      dataIndex: "description",
      width: 240,
      ellipsis: true,
      render: (text: string) => text || "-",
    }, {
      title: "累计事件数",
      dataIndex: "eventCount",
      width: 120,
      render: (value: number) => (value || 0).toLocaleString(),
    }, {
      title: "首次出现",
      dataIndex: "firstSeenDate",
      width: 120,
      render: (text: string) => (text ? dayjs(text).format(DATE_FORMAT) : "-"),
    }, {
      title: "末次出现",
      dataIndex: "lastSeenDate",
      width: 120,
      render: (text: string) => (text ? dayjs(text).format(DATE_FORMAT) : "-"),
    }, {
      title: "更新人",
      dataIndex: "updateNickname",
      width: 120,
      render: (text: string, record: IUtmItem) => text || record.updateUsername || "-",
    }, {
      title: "更新时间",
      dataIndex: "updateTime",
      width: 180,
      render: (text: string) => (text ? dayjs(text).format(DATETIME_FORMAT) : "-"),
    }, {
      title: "操作",
      key: "action",
      width: 190,
      fixed: "right",
      render: (_, record: IUtmItem) => (
        <Space>
          <a onClick={() => handleEdit(record)}>编辑</a>
          {isDeleted ? (
            <a onClick={() => handleRestore(record)}>恢复</a>
          ) : (
            <>
              <Tooltip title="按数据起点重算该条累计（覆盖，不是累加）">
                <a onClick={() => handleRecalc(record)}>重新统计</a>
              </Tooltip>
              <Popconfirm
                title="确定要删除这条 UTM 吗？"
                description="删除后后续统计不再计入该取值，UTM 分析也会忽略它，可在「已删除」里恢复。"
                onConfirm={() => handleDelete(record)}
                okText="确定"
                cancelText="取消"
              >
                <a style={{ color: "var(--px-color-error)" }}>删除</a>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ], [isDeleted, handleEdit, handleDelete, handleRestore, handleRecalc])

  const exButtons = (
    <>
      <Button
        type="primary"
        onClick={handleSync}
        loading={loading.pointManageUtmModel?.syncStat}
      >
        同步统计
      </Button>
      <Tooltip title="统计按完整自然日结算，滚动截止到目标日；当天的量会在下一个批次计入">
        <Tag className={styles.cursorTag} color={cursor?.cursorDate ? "success" : "warning"}>
          {cursor?.cursorDate ? `统计截止 ${cursor.cursorDate}` : "未初始化"}
        </Tag>
      </Tooltip>
    </>
  )

  const tabItems = [
    {
      key: "active",
      label: "有效 UTM",
      children: null,
    },
    {
      key: "deleted",
      label: "已删除 UTM",
      children: null,
    },
  ]

  return (
    <div className={styles.utmManage}>
      <PageHeader
        title="UTM 管理"
        onRefresh={handleRefresh}
        loading={loading.pointManageUtmModel?.getUtmList}
      />
      <p className={styles.description}>
        系统会把埋点上报里出现过的 UTM 取值按维度统计进来。这里可以给取值起别名、写描述，
        也可以删除误报或废弃的取值 —— 删除是软删除，之后的统计不再计入它，未来的 UTM 分析也会忽略它。
        「已删除」页签里可以随时恢复。
      </p>
      <div className={styles.tabContent}>
        <Tabs items={tabItems} activeKey={activeTab} onChange={handleTabChange} />
        <FormComponent formItems={formItems} />
        <TableComponent<IUtmItem>
          exButtons={exButtons}
          dataSource={utmList}
          columns={columns}
          loading={loading.pointManageUtmModel?.getUtmList}
          paginationData={pagination}
        />
      </div>
      <EditPopup
        record={selectedRecord || undefined}
        open={editPopupOpen}
        onClose={closeEditPopup}
        onSubmit={handleSubmitEdit}
      />
    </div>
  )
}

export default UtmManage
