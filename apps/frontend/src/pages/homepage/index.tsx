import React, { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { Card, DatePicker, Row, Col, Spin, message, Empty, Pagination } from "antd"
import dayjs, { Dayjs } from "dayjs"
import { useHistoryListener } from "@/hooks"
import PageHeader from "@components/PageHeader"
import { IDashboard, DashboardType, AnalysisType } from "@pages/data-analysis/dashboard-config/type"
import { queryDashboardList, queryDashboardData } from "@pages/data-analysis/dashboard-config/services"
import * as styles from "./styles.module.scss"

const { RangePicker } = DatePicker

// 每页显示的看板数量
const PAGE_SIZE = 12

const Homepage = () => {
  const [dashboardList, setDashboardList] = useState<IDashboard[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: PAGE_SIZE,
    total: 0,
  })
  const [globalTimeRange, setGlobalTimeRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ])
  const [dashboardDataMap, setDashboardDataMap] = useState<Record<number, any>>({})
  const [dashboardLoadingMap, setDashboardLoadingMap] = useState<Record<number, boolean>>({})
  const loadedDashboardIdsRef = useRef<Set<number>>(new Set())
  const loadingDashboardIdsRef = useRef<Set<number>>(new Set())
  const cardRefs = useRef<Record<number, HTMLDivElement>>({})
  const observerRef = useRef<IntersectionObserver | null>(null)
  const globalTimeRangeRef = useRef<[Dayjs, Dayjs]>(globalTimeRange)

  const loadDashboardList = useCallback(async (page = 1, pageSize = PAGE_SIZE) => {
    setLoading(true)
    try {
      const { data } = await queryDashboardList({
        page,
        pageSize,
      })
      setDashboardList(data?.list || [])
      setPagination({
        current: data?.page || page,
        pageSize: data?.pageSize || pageSize,
        total: data?.total || 0,
      })
    } catch (error: any) {
      message.error(error?.msg || '获取看板列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDashboardData = useCallback(async (dashboardId: number, timeRange: [Dayjs, Dayjs]) => {
    // 如果已经在加载中或已加载，避免重复加载
    if (loadingDashboardIdsRef.current.has(dashboardId) || loadedDashboardIdsRef.current.has(dashboardId)) {
      return
    }
    
    // 标记为正在加载
    loadingDashboardIdsRef.current.add(dashboardId)
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
      // 标记为已加载
      loadedDashboardIdsRef.current.add(dashboardId)
    } catch (error: any) {
      message.error(error?.msg || '加载看板数据失败')
      // 加载失败时，从已加载集合中移除，允许重试
      loadedDashboardIdsRef.current.delete(dashboardId)
    } finally {
      loadingDashboardIdsRef.current.delete(dashboardId)
      setDashboardLoadingMap((prev) => ({ ...prev, [dashboardId]: false }))
    }
  }, [])

  // 设置 Intersection Observer 来懒加载看板数据
  useEffect(() => {
    // 清理旧的 observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // 创建新的 observer
    // 注意：observer 回调中使用 globalTimeRangeRef.current 来获取最新的时间范围
    // 这样就不需要将 globalTimeRange 作为依赖，避免时间范围变化时重新创建 observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // 注意：这里使用 forEach 调用异步函数但不等待是合理的
        // 因为这是懒加载场景，每个看板的数据加载是独立的，有各自的加载状态
        // Intersection Observer 的回调是事件驱动的，不需要等待所有数据加载完成
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const dashboardId = parseInt(entry.target.getAttribute('data-dashboard-id') || '0', 10)
            if (dashboardId && !loadedDashboardIdsRef.current.has(dashboardId) && !loadingDashboardIdsRef.current.has(dashboardId)) {
              // 只有当看板进入视口且尚未加载时才加载数据
              // 使用 ref 获取最新的时间范围，避免闭包问题
              loadDashboardData(dashboardId, globalTimeRangeRef.current).catch((error) => {
                // 错误已在 loadDashboardData 中处理，这里只做兜底
                console.error(`加载看板 ${dashboardId} 数据失败:`, error)
              })
            }
          }
        })
      },
      {
        rootMargin: '50px', // 提前50px开始加载
        threshold: 0.1,
      }
    )

    // 延迟一下，确保 DOM 已更新后再观察
    const timer = setTimeout(() => {
      // 观察所有看板卡片
      Object.values(cardRefs.current).forEach((ref) => {
        if (ref && observerRef.current) {
          observerRef.current.observe(ref)
        }
      })
    }, 100)

    return () => {
      clearTimeout(timer)
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
    // 注意：不包含 globalTimeRange 作为依赖，因为时间范围变化时不需要重新创建 observer
    // 时间范围变化时，通过 handleTimeRangeChange 来重新加载已加载的看板数据
    // observer 回调中使用 globalTimeRangeRef.current 来获取最新的时间范围
  }, [dashboardList, loadDashboardData])

  useHistoryListener((location) => {
    const { pathname } = location
    if (pathname === '/' || pathname === '/home' || pathname === '/homepage' || pathname === '/index') {
      loadDashboardList(1, PAGE_SIZE)
    }
  })

  // 同步更新 ref，确保 observer 回调中使用的始终是最新的时间范围
  useEffect(() => {
    globalTimeRangeRef.current = globalTimeRange
  }, [globalTimeRange])

  const handleTimeRangeChange = useCallback(async (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      const newTimeRange: [Dayjs, Dayjs] = [dates[0], dates[1]]
      setGlobalTimeRange(newTimeRange)
      // 同步更新 ref
      globalTimeRangeRef.current = newTimeRange
      
      // 只重新加载已加载过的看板数据（使用 ref 获取最新状态）
      // 使用 Promise.allSettled 来等待所有异步操作完成，但不阻塞UI
      const dashboardIds = Array.from(loadedDashboardIdsRef.current)
      const loadPromises = dashboardIds.map((dashboardId) => {
        // 清除已加载标记，允许重新加载
        loadedDashboardIdsRef.current.delete(dashboardId)
        return loadDashboardData(dashboardId, newTimeRange)
      })
      
      // 等待所有数据加载完成（使用 allSettled 确保即使有失败也不会中断）
      await Promise.allSettled(loadPromises)
    }
  }, [loadDashboardData])

  const handlePageChange = useCallback((page: number, pageSize: number) => {
    // 清空已加载的看板ID，因为列表已变化
    loadedDashboardIdsRef.current.clear()
    loadingDashboardIdsRef.current.clear()
    setDashboardDataMap({})
    loadDashboardList(page, pageSize)
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
    // 清空已加载的看板ID，重新加载
    loadedDashboardIdsRef.current.clear()
    loadingDashboardIdsRef.current.clear()
    setDashboardDataMap({})
    loadDashboardList(pagination.current, pagination.pageSize)
  }, [loadDashboardList, pagination])

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
        <>
          <Row gutter={[16, 16]}>
            {dashboardList.map((dashboard) => (
              <Col key={dashboard.id} xs={24} sm={24} md={12} lg={12} xl={8}>
                <div
                  ref={(el) => {
                    if (el && dashboard.id) {
                      cardRefs.current[dashboard.id] = el
                    }
                  }}
                  data-dashboard-id={dashboard.id}
                >
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
                </div>
              </Col>
            ))}
          </Row>
          {pagination.total > pagination.pageSize && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Pagination
                current={pagination.current}
                pageSize={pagination.pageSize}
                total={pagination.total}
                showSizeChanger
                showQuickJumper
                showTotal={(total) => `共 ${total} 个看板`}
                onChange={handlePageChange}
                onShowSizeChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Homepage
