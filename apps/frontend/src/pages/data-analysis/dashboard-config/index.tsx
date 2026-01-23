import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button, message, Popconfirm, Space, TableProps, Tag } from "antd"
import { AddOne, Help } from "@icon-park/react"
import { useHistoryListener } from "@/hooks"
import { useNavigate } from "react-router-dom"
import { AnalysisType, DashboardType, IDashboard } from "./type"
import dayjs from "dayjs"
import PageHeader from "@components/PageHeader"
import TableComponent from "@components/TableComponent"
import FormComponent from "@components/FormComponent"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import * as styles from "./styles.module.scss"
import ConvertToPublicPopup from "./components/convert-to-public"
import GuidePopup from "./components/guide-popup"
import queryString from "query-string"
import { deleteDashboard, queryDashboardList } from "./services"

function DashboardConfig() {
  const navigate = useNavigate()

  const [dashboardList, setDashboardList] = useState<IDashboard[]>([])
  const [pagination, setPagination] = useState({
    total: 0,
    current: 1,
    pageSize: 10,
  })
  const paginationRef = useRef(pagination)
  const [guidePopupOpen, setGuidePopupOpen] = useState(false)
  const [convertPopupOpen, setConvertPopupOpen] = useState(false)
  const [selectedDashboard, setSelectedDashboard] = useState<IDashboard | null>(null)
  const [filterType, setFilterType] = useState<DashboardType | ''>('')
  const [filterAnalysisType, setFilterAnalysisType] = useState<AnalysisType | ''>('')

  // 同步 paginationRef
  useEffect(() => {
    paginationRef.current = pagination
  }, [pagination])

  const loadDashboardList = useCallback(async (page = 1, pageSize = 10) => {
    try {
      const { data } = await queryDashboardList({
        type: filterType || undefined,
        analysisType: filterAnalysisType || undefined,
        page,
        pageSize,
      })
      setDashboardList(data?.list || [])
      setPagination({
        total: data?.total || 0,
        current: data?.page || page,
        pageSize: data?.pageSize || pageSize,
      })
    } catch (error: any) {
      message.error(error?.msg || '获取看板列表失败')
    }
  }, [filterType, filterAnalysisType])

  useHistoryListener((location) => {
    const { pathname } = location
    if (pathname === '/data-analysis/dashboardConfig') {
      loadDashboardList()
    }
  })

  useEffect(() => {
    loadDashboardList(pagination.current, pagination.pageSize)
  }, [loadDashboardList])

  const handleAddDashboard = useCallback(() => {
    setGuidePopupOpen(true)
  }, [])

  const handleDeleteDashboard = useCallback(async (dashboard: IDashboard) => {
    if (dashboard.id) {
      try {
        await deleteDashboard(dashboard.id)
        message.success('删除成功')
        loadDashboardList(paginationRef.current.current, paginationRef.current.pageSize)
      } catch (error: any) {
        message.error(error?.msg || '删除失败')
      }
    }
  }, [loadDashboardList])

  const handleEditDashboard = useCallback((dashboard: IDashboard) => {
    // 获取看板配置
    const config = dashboard.config || {}

    // 根据分析类型获取对应的配置
    let queryParams: any = {}
    if (dashboard.analysisType === AnalysisType.EVENT && config.eventAnalysis) {
      queryParams = { ...config.eventAnalysis }
    } else if (dashboard.analysisType === AnalysisType.FUNNEL && config.funnelAnalysis) {
      queryParams = { ...config.funnelAnalysis }
    } else if (dashboard.analysisType === AnalysisType.USER_PATH && config.userPathAnalysis) {
      queryParams = { ...config.userPathAnalysis }
    } else if (dashboard.analysisType === AnalysisType.ATTRIBUTION && config.attributionAnalysis) {
      queryParams = { ...config.attributionAnalysis }
    }

    // 确保有配置参数
    if (!queryParams || Object.keys(queryParams).length === 0) {
      message.warning('看板配置为空，无法编辑')
      return
    }

    // 添加看板ID参数
    queryParams.dashboardId = dashboard.id

    // 转换为URL参数，确保对象被序列化为JSON字符串（与useRouter的refresh方法一致）
    const obj: any = {}
    Object.keys(queryParams).forEach(key => {
      if (typeof queryParams[key] === 'object' && queryParams[key] !== null) {
        obj[key] = JSON.stringify(queryParams[key])
      } else {
        obj[key] = queryParams[key]
      }
    })
    const search = queryString.stringify(obj, {
      encode: false,
    })

    // 跳转到对应的分析页面
    const routeMap: Record<AnalysisType, string> = {
      [AnalysisType.EVENT]: '/data-analysis/event',
      [AnalysisType.FUNNEL]: '/data-analysis/funnel',
      [AnalysisType.USER_PATH]: '/data-analysis/userPath',
      [AnalysisType.ATTRIBUTION]: '/data-analysis/attribution',
    }
    const route = routeMap[dashboard.analysisType]
    if (route) {
      navigate(`${route}?${search}`)
    }
  }, [navigate])

  const handleConvertToPublic = useCallback((dashboard: IDashboard) => {
    setSelectedDashboard(dashboard)
    setConvertPopupOpen(true)
  }, [])


  const handleConvertSubmit = useCallback(async () => {
    setConvertPopupOpen(false)
    setSelectedDashboard(null)
    loadDashboardList(paginationRef.current.current, paginationRef.current.pageSize)
  }, [loadDashboardList])

  const getAnalysisTypeText = useCallback((type: AnalysisType) => {
    const map = {
      [AnalysisType.EVENT]: '事件分析',
      [AnalysisType.FUNNEL]: '漏斗分析',
      [AnalysisType.USER_PATH]: '用户路径分析',
      [AnalysisType.ATTRIBUTION]: '归因分析',
    }
    return map[type] || type
  }, [])

  const formItems: IFormItem[] = useMemo(() => [
    {
      key: 'type',
      label: '看板类型',
      type: FormItemType.SELECT,
      options: [
        { label: '全部', value: '' },
        { label: '个人看板', value: DashboardType.PERSONAL },
        { label: '公共看板', value: DashboardType.PUBLIC },
      ],
      onChange: (value: any) => {
        setFilterType(value as DashboardType | '')
      },
    },
    {
      key: 'analysisType',
      label: '分析类型',
      type: FormItemType.SELECT,
      options: [
        { label: '全部', value: '' },
        { label: '事件分析', value: AnalysisType.EVENT },
        { label: '漏斗分析', value: AnalysisType.FUNNEL },
        { label: '用户路径分析', value: AnalysisType.USER_PATH },
        { label: '归因分析', value: AnalysisType.ATTRIBUTION },
      ],
      onChange: (value: any) => {
        setFilterAnalysisType(value as AnalysisType | '')
      },
    },
  ], [])

  const columns: TableProps<IDashboard>['columns'] = useMemo(() => [
    {
      title: '看板名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '看板类型',
      dataIndex: 'type',
      width: 120,
      render: (type: DashboardType) => (
        <Tag color={type === DashboardType.PUBLIC ? 'blue' : 'green'}>
          {type === DashboardType.PUBLIC ? '公共看板' : '个人看板'}
        </Tag>
      ),
    },
    {
      title: '分析类型',
      dataIndex: 'analysisType',
      width: 120,
      render: (type: AnalysisType) => getAnalysisTypeText(type),
    },
    {
      title: '创建者',
      dataIndex: 'creatorName',
      width: 120,
    },
    {
      title: '展示图表',
      dataIndex: 'displayChart',
      width: 100,
      render: (display: boolean) => (
        <Tag color={display ? 'success' : 'default'}>
          {display ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '展示表格',
      dataIndex: 'displayTable',
      width: 100,
      render: (display: boolean) => (
        <Tag color={display ? 'success' : 'default'}>
          {display ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 180,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updateTime',
      width: 180,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_, record) => {
        // 个人看板只有创建者可以编辑和删除
        // 公共看板只有管理员可以编辑和删除
        // 个人看板可以转为公共看板
        const canEdit = record.type === DashboardType.PERSONAL // 这里应该检查当前用户是否为创建者或管理员
        const canDelete = record.type === DashboardType.PERSONAL // 同上
        const canConvert = record.type === DashboardType.PERSONAL // 只有个人看板可以转换

        return (
          <Space>
            {canEdit && (
              <a onClick={() => handleEditDashboard(record)}>编辑</a>
            )}
            {canConvert && (
              <a onClick={() => handleConvertToPublic(record)}>转为公共看板</a>
            )}
            {canDelete && (
              <Popconfirm
                title="确定要删除该看板吗？"
                onConfirm={() => handleDeleteDashboard(record)}
                okText="确定"
                cancelText="取消"
              >
                <a style={{ color: '#ff4d4f' }}>删除</a>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ], [handleEditDashboard, handleDeleteDashboard, handleConvertToPublic, getAnalysisTypeText])

  const handleRefresh = useCallback(() => {
    loadDashboardList(paginationRef.current.current, paginationRef.current.pageSize)
  }, [loadDashboardList])

  return (
    <div className={styles.dashboardConfig}>
      <PageHeader
        title="看板设置"
        onRefresh={handleRefresh}
        loading={false}
        extra={
          <Button
            type="link"
            icon={<Help theme="outline" size="16" fill="#000000" />}
            onClick={() => navigate('/guide/data-analysis/dashboard-config')}
          >
            说明
          </Button>
        }
      />
      <p className={styles.description}>
        管理数据分析看板配置，包括个人看板和公共看板。创建看板请在对应的数据分析页面配置参数后点击&#34;保存为看板&#34;按钮。个人看板仅创建者可管理，公共看板管理员可管理，所有有权限的用户可查看。
      </p>
      <FormComponent formItems={formItems} />
      <TableComponent<IDashboard>
        exButtons={(
          <Button type="primary" onClick={handleAddDashboard}>
            创建看板指引
            <AddOne style={{ display: "flex" }} theme="outline" size="14" fill="#FFFFFF" />
          </Button>
        )}
        dataSource={dashboardList}
        columns={columns}
        loading={false}
        paginationData={pagination}
        onPaginationChange={(pagination: any) => {
          loadDashboardList(pagination.current, pagination.pageSize)
        }}
      />
      <GuidePopup
        open={guidePopupOpen}
        onClose={() => setGuidePopupOpen(false)}
      />
      <ConvertToPublicPopup
        dashboard={selectedDashboard || undefined}
        open={convertPopupOpen}
        onClose={() => {
          setConvertPopupOpen(false)
          setSelectedDashboard(null)
        }}
        onSubmit={handleConvertSubmit}
      />
    </div>
  )
}

export default DashboardConfig
