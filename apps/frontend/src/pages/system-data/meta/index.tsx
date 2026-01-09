import React, { useEffect, useRef, useState } from "react"
import { Card, Col, DatePicker, Progress, Row, Spin, Statistic } from "antd"
import PageHeader from "@components/PageHeader"
import * as styles from "./styles.module.scss"
import * as echarts from "echarts"
import { useDispatch } from "react-redux"
import { ISystemDataMetaState } from "./type"
import dayjs from "dayjs"
import { useHistoryListener, useModel, useQuery, useRouter } from "@/hooks"
import { Dispatch } from "@/store/storeContext"

const { RangePicker } = DatePicker

// 元数据页面组件
function Meta() {
  // 图表DOM引用
  const chartRef = useRef<HTMLDivElement>(null)
  // 图表实例引用
  const chartInstance = useRef<echarts.ECharts | null>(null)
  // 加载状态
  const [loading, setLoading] = useState(true)
  // 日期范围选择状态
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  // 使用useModel获取状态
  const {
    overview,
    dataTrend,
    cleaningStats,
    firstCleaningDetail,
    finalCleaningDetail,
  } = useModel<ISystemDataMetaState>('systemDataMetaModel')

  // 防御性编程：确保 overview 不为 null
  const safeOverview = overview || {
    originalDataTotal: '',
    finalCleanedData: '',
    firstCleaningSuccessRate: 0,
    finalCleaningSuccessRate: 0,
  }

  // 防御性编程：确保其他数据不为 null
  const safeDataTrend = dataTrend || {
    xAxis: [],
    series: [],
  }

  const safeCleaningStats = cleaningStats || {
    firstCleaning: {
      successRate: 0,
      successCount: '',
      failCount: '',
    },
    finalCleaning: {
      successRate: 0,
      successCount: '',
      failCount: '',
    },
  }

  const safeFirstCleaningDetail = firstCleaningDetail || {
    successRate: 0,
    successCount: '',
    failCount: '',
    detailList: [],
  }

  const safeFinalCleaningDetail = finalCleaningDetail || {
    successRate: 0,
    successCount: '',
    failCount: '',
    detailList: [],
  }

  // 使用useRouter和useQuery获取路由参数
  const { refresh } = useRouter()
  const query = useQuery()

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

  // 组件挂载时获取数据
  useEffect(() => {
    fetchData()
  }, [])

  // 获取数据函数
  const fetchData = async () => {
    setLoading(true)
    try {
      // 获取日期参数，优先使用查询参数
      let dateStr = query.date
      if (!dateStr) {
        // 默认获取昨天的数据
        const yesterday = dayjs().subtract(1, 'day')
        dateStr = yesterday.format('YYYY-MM-DD')
      }

      // 并行获取所有需要的数据
      await Promise.all([
        getMetaOverview({ date: dateStr }),
        getDataTrend({ startDate: dateStr, endDate: dateStr }),
        getCleaningStats({ date: dateStr }),
        getFirstCleaningDetail({ date: dateStr }),
        getFinalCleaningDetail({ date: dateStr }),
      ])
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 日期范围选择处理
  const handleDateChange = async (dates: [dayjs.Dayjs, dayjs.Dayjs] | null) => {
    setDateRange(dates)
    setLoading(true)

    try {
      if (dates) {
        const [startDate, endDate] = dates
        const startStr = startDate.format('YYYY-MM-DD')
        const endStr = endDate.format('YYYY-MM-DD')

        // 并行获取所有需要的数据
        await Promise.all([
          getMetaOverview({ date: startStr }),
          getDataTrend({ startDate: startStr, endDate: endStr }),
          getCleaningStats({ date: startStr }),
          getFirstCleaningDetail({ date: startStr }),
          getFinalCleaningDetail({ date: startStr }),
        ])

        // 更新查询参数
        refresh({ date: startStr, startDate: startStr, endDate: endStr }, false)
      } else {
        // 如果没有选择日期，获取昨天的数据
        const yesterday = dayjs().subtract(1, 'day')
        const dateStr = yesterday.format('YYYY-MM-DD')

        await Promise.all([
          getMetaOverview({ date: dateStr }),
          getDataTrend({ startDate: dateStr, endDate: dateStr }),
          getCleaningStats({ date: dateStr }),
          getFirstCleaningDetail({ date: dateStr }),
          getFinalCleaningDetail({ date: dateStr }),
        ])

        // 清除查询参数
        refresh({}, false)
      }
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
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
              color: '#536DFE',
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
  }, [safeDataTrend]) // 依赖safeDataTrend，当数据更新时重新渲染图表

  // 显示加载状态
  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Spin size="large" />
        </div>
      </div>
    )
  }

  // 渲染页面内容
  return (
    <div className={styles.container}>
      <PageHeader
        title="元数据"
        onRefresh={fetchData}
        loading={loading}
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

      {/* 元数据概览卡片行 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="原始数据总量"
              value={safeOverview.originalDataTotal} // 显示原始数据总量
              valueStyle={{ color: '#3f8cff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="最终清洗数据量"
              value={safeOverview.finalCleanedData} // 显示最终清洗数据量
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="初次清洗成功率"
              value={safeOverview.firstCleaningSuccessRate ?? '-'} // 显示初次清洗成功率
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              suffix="%"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="最终清洗成功率"
              value={safeOverview.finalCleaningSuccessRate ?? '-'} // 显示最终清洗成功率
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* 数据趋势图表卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="上报数据量趋势">
            <div ref={chartRef} style={{ height: '400px', width: '100%' }} />
          </Card>
        </Col>
      </Row>

      {/* 清洗详情卡片行 */}
      <Row gutter={[16, 16]}>
        {/* 初次清洗详情卡片 */}
        <Col xs={24} lg={12}>
          <Card title="初次数据清洗">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>清洗成功率</span>
                </div>
                <Progress percent={safeFirstCleaningDetail.successRate} strokeColor="#52c41a" />
              </div>

              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title="清洗成功数">
                    <Statistic value={safeFirstCleaningDetail.successCount} /> {/* 显示初次清洗成功数 */}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="清洗失败数">
                    <Statistic value={safeFirstCleaningDetail.failCount}
                      valueStyle={{ color: '#ff4d4f' }} /> {/* 显示初次清洗失败数 */}
                  </Card>
                </Col>
              </Row>
            </div>
          </Card>
        </Col>

        {/* 最终清洗详情卡片 */}
        <Col xs={24} lg={12}>
          <Card title="最终数据清洗">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>清洗成功率</span>
                </div>
                <Progress percent={safeFinalCleaningDetail.successRate} strokeColor="#52c41a" />
              </div>

              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title="清洗成功数">
                    <Statistic value={safeFinalCleaningDetail.successCount} /> {/* 显示最终清洗成功数 */}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="清洗失败数">
                    <Statistic value={safeFinalCleaningDetail.failCount}
                      valueStyle={{ color: '#ff4d4f' }} /> {/* 显示最终清洗失败数 */}
                  </Card>
                </Col>
              </Row>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// 直接导出组件，不再使用connect高阶组件
export default Meta
