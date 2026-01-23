import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Card, DatePicker, Row, Col, Spin, message, Empty } from "antd"
import dayjs, { Dayjs } from "dayjs"
import { useHistoryListener } from "@/hooks"
import PageHeader from "@components/PageHeader"
import { IDashboard, DashboardType, AnalysisType } from "@pages/data-analysis/dashboard-config/type"
import { queryDashboardList, queryDashboardData } from "@pages/data-analysis/dashboard-config/services"
import * as styles from "./styles.module.scss"

const { RangePicker } = DatePicker

const Homepage = () => {
  const [dashboardList, setDashboardList] = useState<IDashboard[]>([])
  const [loading, setLoading] = useState(false)
  const [globalTimeRange, setGlobalTimeRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ])
  const [dashboardDataMap, setDashboardDataMap] = useState<Record<number, any>>({})
  const [dashboardLoadingMap, setDashboardLoadingMap] = useState<Record<number, boolean>>({})

  const loadDashboardList = useCallback(async () => {
    setLoading(true)
    try {
      // 获取所有看板（个人看板和公共看板）
      const { data } = await queryDashboardList({
        page: 1,
        pageSize: 100, // 首页显示所有看板
      })
      setDashboardList(data?.list || [])
      
      // 加载所有看板的数据
      if (data?.list) {
        data.list.forEach((dashboard) => {
          if (dashboard.id) {
            loadDashboardData(dashboard.id, globalTimeRange)
          }
        })
      }
    } catch (error: any) {
      message.error(error?.msg || '获取看板列表失败')
    } finally {
      setLoading(false)
    }
  }, [globalTimeRange])

  const loadDashboardData = useCallback(async (dashboardId: number, timeRange: [Dayjs, Dayjs]) => {
    setDashboardLoadingMap((prev) => ({ ...prev, [dashboardId]: true }))
    try {
      const { data } = await queryDashboardData({
        dashboardId,
        timeRange: [
          timeRange[0].format('YYYY-MM-DD'),
          timeRange[1].format('YYYY-MM-DD'),
        ],
      })
      setDashboardDataMap((prev) => ({
        ...prev,
        [dashboardId]: data,
      }))
    } catch (error: any) {
      message.error(error?.msg || `加载看板数据失败: ${error?.msg}`)
    } finally {
      setDashboardLoadingMap((prev) => ({ ...prev, [dashboardId]: false }))
    }
  }, [])

  useHistoryListener((location) => {
    const { pathname } = location
    if (pathname === '/' || pathname === '/home' || pathname === '/homepage' || pathname === '/index') {
      loadDashboardList()
    }
  })

  const handleTimeRangeChange = useCallback((dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      const newTimeRange: [Dayjs, Dayjs] = [dates[0], dates[1]]
      setGlobalTimeRange(newTimeRange)
      
      // 重新加载所有看板的数据
      dashboardList.forEach((dashboard) => {
        if (dashboard.id) {
          loadDashboardData(dashboard.id, newTimeRange)
        }
      })
    }
  }, [dashboardList, loadDashboardData])

  const getAnalysisTypeText = useCallback((type: AnalysisType) => {
    const map = {
      [AnalysisType.EVENT]: '事件分析',
      [AnalysisType.FUNNEL]: '漏斗分析',
      [AnalysisType.USER_PATH]: '用户路径分析',
      [AnalysisType.ATTRIBUTION]: '归因分析',
    }
    return map[type] || type
  }, [])

  const renderDashboardContent = useCallback((dashboard: IDashboard) => {
    const data = dashboardDataMap[dashboard.id!]
    const isLoading = dashboardLoadingMap[dashboard.id!]

    if (isLoading) {
      return <Spin size="small" />
    }

    if (!data) {
      return <Empty description="暂无数据" />
    }

    return (
      <div className={styles.dashboardContent}>
        {/* 这里可以根据不同的分析类型渲染不同的图表和表格 */}
        {/* 由于图表渲染比较复杂，这里先显示一个简单的数据预览 */}
        {dashboard.displayChart && (
          <div className={styles.chartArea}>
            <div className={styles.placeholder}>图表展示区域</div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: 8 }}>
              提示：完整的图表展示需要根据分析类型和数据结构进行定制化开发
            </div>
          </div>
        )}
        {dashboard.displayTable && (
          <div className={styles.tableArea}>
            <div className={styles.placeholder}>表格展示区域</div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: 8 }}>
              提示：完整的表格展示需要根据分析类型和数据结构进行定制化开发
            </div>
          </div>
        )}
      </div>
    )
  }, [dashboardDataMap, dashboardLoadingMap])

  const handleRefresh = useCallback(() => {
    loadDashboardList()
  }, [loadDashboardList])

  return (
    <div className={styles.homepage}>
      <PageHeader
        title="数据看板"
        onRefresh={handleRefresh}
        loading={loading}
        extra={(
          <RangePicker
            value={globalTimeRange}
            onChange={handleTimeRangeChange}
            format="YYYY-MM-DD"
            size="small"
          />
        )}
      />
      <p className={styles.description}>
        统一展示所有数据分析看板，可以统一调整所有看板的日期范围。个人看板仅自己可见，公共看板所有有权限的用户可见。
      </p>
      
      {loading && dashboardList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
        </div>
      ) : dashboardList.length === 0 ? (
        <Empty description="暂无看板数据" />
      ) : (
        <Row gutter={[16, 16]}>
          {dashboardList.map((dashboard) => (
            <Col key={dashboard.id} xs={24} sm={24} md={12} lg={12} xl={8}>
              <Card
                title={
                  <div className={styles.cardTitle}>
                    <span>{dashboard.name}</span>
                    <span className={styles.cardTag}>
                      {dashboard.type === DashboardType.PUBLIC ? '公共' : '个人'}
                    </span>
                  </div>
                }
                extra={
                  <span className={styles.analysisType}>
                    {getAnalysisTypeText(dashboard.analysisType)}
                  </span>
                }
                className={styles.dashboardCard}
                loading={dashboardLoadingMap[dashboard.id!]}
              >
                <div className={styles.cardMeta}>
                  <span>创建者: {dashboard.creatorName}</span>
                  {dashboard.type === DashboardType.PUBLIC && dashboard.permissions && dashboard.permissions.length > 0 && (
                    <span className={styles.permissions}>
                      权限: {dashboard.permissions.join(', ')}
                    </span>
                  )}
                </div>
                {renderDashboardContent(dashboard)}
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}

export default Homepage
