import React, { useEffect, useMemo, useRef } from "react"
import { Alert, Card, Col, DatePicker, Row, Spin, Statistic, Tooltip, theme } from "antd"
import PageHeader from "@components/PageHeader"
import * as styles from "./styles.module.scss"
import * as echarts from "echarts"
import { useDispatch } from "react-redux"
import { ISystemDataMetaState } from "./type"
import dayjs from "dayjs"
import { useHistoryListener, useLoading, useModel, useQuery, useRouter } from "@/hooks"
import { Dispatch } from "@/store/storeContext"
import { IDateParams } from "./services"
import { CleaningRateProgress, CleaningRateStatistic } from "./cleaning-rate"

const { RangePicker } = DatePicker

// 元数据页面组件
function Meta() {
  // 图表DOM引用
  const chartRef = useRef<HTMLDivElement>(null)
  // 图表实例引用
  const chartInstance = useRef<echarts.ECharts | null>(null)

  // 主题 token
  const { token } = theme.useToken()

  // 各接口的加载状态（来自 rematch loading 插件）
  const loading = useLoading()

  // 使用useModel获取状态
  const {
    overview,
    dataTrend,
    firstCleaningDetail,
    finalCleaningDetail,
  } = useModel<ISystemDataMetaState>('systemDataMetaModel')

  // 防御性编程：确保 overview 不为 null
  const safeOverview = overview || {
    originalDataTotal: '',
    finalCleanedData: '',
    firstCleaningSuccessRate: null,
    finalCleaningSuccessRate: null,
  }

  // 防御性编程：确保其他数据不为 null
  const safeDataTrend = dataTrend || {
    xAxis: [],
    series: [],
  }

  const safeFirstCleaningDetail = firstCleaningDetail || {
    successRate: null,
    successCount: '—',
    failCount: '—',
    detailList: [],
  }

  const safeFinalCleaningDetail = finalCleaningDetail || {
    successRate: null,
    successCount: '—',
    failCount: '—',
    detailList: [],
  }

  // 各模块的加载状态
  const overviewLoading = loading.systemDataMetaModel.getMetaOverview
  const trendLoading = loading.systemDataMetaModel.getDataTrend
  const cleaningStatsLoading = loading.systemDataMetaModel.getCleaningStats
  const firstCleaningLoading = loading.systemDataMetaModel.getFirstCleaningDetail
  const finalCleaningLoading = loading.systemDataMetaModel.getFinalCleaningDetail
  // 页面整体加载状态，用于 PageHeader 刷新按钮
  const pageLoading = overviewLoading || trendLoading || cleaningStatsLoading
    || firstCleaningLoading || finalCleaningLoading

  // 使用useRouter和useQuery获取路由参数
  const { refresh } = useRouter()
  const query = useQuery<IDateParams>()
  // 日期由路由保存，刷新页面和浏览器前进/后退时恢复选择。
  const dateRange = useMemo<[dayjs.Dayjs, dayjs.Dayjs] | null>(() => {
    const start = query.startDate || query.date
    const end = query.endDate || query.date
    if (!start || !end) return null
    const startDay = dayjs(start)
    const endDay = dayjs(end)
    return startDay.isValid() && endDay.isValid() ? [startDay, endDay] : null
  }, [query.date, query.startDate, query.endDate])

  // 使用useDispatch获取dispatch方法
  const dispatch = useDispatch<Dispatch>()

  // 从dispatch中获取方法
  const {
    getMetaOverview,
    getDataTrend,
    getCleaningStats,
    getFirstCleaningDetail,
    getFinalCleaningDetail,
  } = dispatch.systemDataMetaModel

  // 监听路由变化
  useHistoryListener((location) => {
    if (location.pathname === '/system-data/meta') {
      fetchData()
    }
  })

  // 获取数据函数
  const fetchData = async () => {
    try {
      // 库存按事件日期筛选，清洗结果按执行完成日期筛选；成功率默认今日。
      const params: IDateParams = query.startDate || query.endDate
        ? { startDate: query.startDate || query.date, endDate: query.endDate || query.date }
        : query.date ? { date: query.date } : {}
      const startStr = params.startDate || params.date
      const endStr = params.endDate || params.date

      await Promise.all([
        getMetaOverview(params),
        getDataTrend(startStr && endStr ? { startDate: startStr, endDate: endStr } : {}),
        getCleaningStats(params),
        getFirstCleaningDetail(params),
        getFinalCleaningDetail(params),
      ])
    } catch (error) {
      console.error('获取数据失败:', error)
    }
  }

  // 路由变化统一触发查询，所有清洗统计使用完整日期范围。
  const handleDateChange = (dates: [dayjs.Dayjs, dayjs.Dayjs] | null) => {
    refresh(dates ? {
      startDate: dates[0].format('YYYY-MM-DD'),
      endDate: dates[1].format('YYYY-MM-DD'),
    } : {}, false)
  }

  // 初始化和更新图表
  useEffect(() => {
    if (chartRef.current) {
      // 初始化ECharts实例
      chartInstance.current = echarts.init(chartRef.current)

      // 配置图表选项
      const option = {
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
          },
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true,
        },
        toolbox: {
          show: true,
          feature: {
            magicType: {
              show: true,
              type: ['line', 'bar'],
              title: {
                line: '切换为折线图',
                bar: '切换为柱状图',
              },
            },
          },
          right: 10,
          top: 10,
        },
        xAxis: [
          {
            type: 'category',
            // 使用从API获取的X轴数据，如果不存在则使用默认值
            data: safeDataTrend?.xAxis || ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
          },
        ],
        yAxis: [
          {
            type: 'value',
          },
        ],
        series: [
          {
            name: '上报数据量',
            type: 'line',
            barWidth: '60%',
            // 使用从API获取的系列数据，如果不存在则使用默认值
            data: safeDataTrend?.series?.[0]?.data || [1000, 1200, 1100, 1300, 1500, 1400, 1600],
            itemStyle: {
              color: token.colorPrimary,
            },
          },
        ],
      }

      // 应用图表配置
      chartInstance.current.setOption(option)

      // 定义窗口大小调整处理函数
      const handleResize = () => {
        chartInstance.current?.resize()
      }

      // 监听窗口大小调整事件
      window.addEventListener('resize', handleResize)

      // 清理函数：移除事件监听器和销毁图表实例
      return () => {
        window.removeEventListener('resize', handleResize)
        chartInstance.current?.dispose()
      }
    }
  }, [safeDataTrend, token.colorPrimary]) // 依赖safeDataTrend，当数据更新时重新渲染图表

  // 渲染页面内容
  return (
    <div className={styles.container}>
      <PageHeader
        title="元数据"
        onRefresh={fetchData}
        loading={pageLoading}
        extra={
          <RangePicker
            value={dateRange}
            onChange={handleDateChange}
            placeholder={['开始日期', '结束日期']}
            format="YYYY-MM-DD"
            // 允许选择今天及以前的日期
            disabledDate={(current) => {
              return current && current > dayjs().endOf('day')
            }}
          />
        }
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="成功率按执行完成日期统计，未选日期时显示今日；仅保留最近35天的执行统计，没有采样时显示“—”。"
      />

      {/* 元数据概览卡片行 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={overviewLoading}>
            <Statistic
              title="原始数据总量"
              value={safeOverview.originalDataTotal} // 显示原始数据总量
              valueStyle={{ color: token.colorPrimary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={overviewLoading}>
            <Statistic
              title="最终清洗数据量"
              value={safeOverview.finalCleanedData} // 显示最终清洗数据量
              valueStyle={{ color: token.colorSuccess }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={overviewLoading}>
            <CleaningRateStatistic
              title={<Tooltip title="按事件处理尝试统计：成功次数 ÷（成功次数 + 失败次数）。不以数据库现有数据量推算。">初次清洗成功率</Tooltip>}
              rate={safeOverview.firstCleaningSuccessRate}
              color={token.colorSuccess}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={overviewLoading}>
            <CleaningRateStatistic
              title={<Tooltip title="按 session 任务执行尝试统计：成功次数 ÷（成功次数 + 失败次数），重试分别计次。">最终清洗成功率</Tooltip>}
              rate={safeOverview.finalCleaningSuccessRate}
              color={token.colorSuccess}
            />
          </Card>
        </Col>
      </Row>

      {/* 数据趋势图表卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="上报数据量趋势">
            <Spin spinning={trendLoading}>
              <div ref={chartRef} style={{ height: '400px', width: '100%' }} />
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* 清洗详情卡片行 */}
      <Row gutter={[16, 16]}>
        {/* 初次清洗详情卡片 */}
        <Col xs={24} lg={12}>
          <Card title="初次数据清洗">
            <Spin spinning={firstCleaningLoading}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>清洗成功率（按事件尝试）</span>
                  </div>
                  <CleaningRateProgress rate={safeFirstCleaningDetail.successRate} color={token.colorSuccess} />
                </div>

                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title={<Tooltip title="所选执行日期内成功写入的事件尝试次数，重试分别计次。">成功事件次数</Tooltip>}>
                      <Statistic value={safeFirstCleaningDetail.successCount ?? '—'} /> {/* 显示初次清洗成功数 */}
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title={<Tooltip title="所选执行日期内校验失败或写入失败的事件尝试次数，重试分别计次。">失败事件次数</Tooltip>}>
                      <Statistic value={safeFirstCleaningDetail.failCount ?? '—'}
                        valueStyle={{ color: token.colorError }} /> {/* 显示初次清洗失败数 */}
                    </Card>
                  </Col>
                </Row>
              </div>
            </Spin>
          </Card>
        </Col>

        {/* 最终清洗详情卡片 */}
        <Col xs={24} lg={12}>
          <Card title="最终数据清洗">
            <Spin spinning={finalCleaningLoading}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>清洗成功率（按 session 任务尝试）</span>
                  </div>
                  <CleaningRateProgress rate={safeFinalCleaningDetail.successRate} color={token.colorSuccess} />
                </div>

                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title={<Tooltip title="所选执行日期内成功完成的 session 任务尝试次数，重试分别计次。">成功任务次数</Tooltip>}>
                      <Statistic value={safeFinalCleaningDetail.successCount ?? '—'} /> {/* 显示最终清洗成功数 */}
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title={<Tooltip title="所选执行日期内执行失败的 session 任务尝试次数，重试分别计次。">失败任务次数</Tooltip>}>
                      <Statistic value={safeFinalCleaningDetail.failCount ?? '—'}
                        valueStyle={{ color: token.colorError }} /> {/* 显示最终清洗失败数 */}
                    </Card>
                  </Col>
                </Row>
              </div>
            </Spin>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// 直接导出组件，不再使用connect高阶组件
export default Meta
