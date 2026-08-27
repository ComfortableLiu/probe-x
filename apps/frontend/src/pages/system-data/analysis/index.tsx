import React, { useEffect, useRef, useState } from "react"
import { Card, Col, DatePicker, Row, Space, Statistic, Table, Button, theme } from "antd"
import { Help } from "@icon-park/react"
import { useNavigate } from "react-router-dom"
import PageHeader from "@components/PageHeader"
import {
  BarChartOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DesktopOutlined,
  DownloadOutlined,
  HourglassOutlined,
  StopOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons'
import * as echarts from 'echarts'
import * as styles from './styles.module.scss'
import { useHistoryListener, useLoading, useModel } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { ISystemDataAnalysisState } from "./type"
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

// 图标映射
const iconMap = {
  'bar-chart': <BarChartOutlined />,
  'user-group': <UsergroupAddOutlined />,
  'clock-circle': <ClockCircleOutlined />,
  'close-circle': <CloseCircleOutlined />,
  'hourglass': <HourglassOutlined />,
  'desktop': <DesktopOutlined />,
  'stop': <StopOutlined />,
  'download': <DownloadOutlined />,
}

const columns = [
  {
    title: '任务名',
    dataIndex: 'taskName',
    key: 'taskName',
  },
  {
    title: '发起任务人',
    dataIndex: 'initiator',
    key: 'initiator',
  },
  {
    title: '任务状态',
    dataIndex: 'status',
    key: 'status',
  },
  {
    title: '任务发起时间',
    dataIndex: 'startTime',
    key: 'startTime',
  },
  {
    title: '任务结束时间',
    dataIndex: 'endTime',
    key: 'endTime',
  },
  {
    title: '任务耗时',
    dataIndex: 'duration',
    key: 'duration',
  },
]

function Analysis() {
  const dispatch = useDispatch<Dispatch>()
  const navigate = useNavigate()
  const loading = useLoading()
  const { token } = theme.useToken()
  // 统计卡片颜色：按序循环使用主题 token 色板
  const statisticColorPalette = [
    token.colorPrimary,
    token.colorSuccess,
    token.colorWarning,
    token.colorError,
    token.colorTextTertiary,
  ]
  const {
    statistics,
    hourlyChartData,
    dailyChartData,
    taskList,
    total,
    page,
    pageSize,
  } = useModel<ISystemDataAnalysisState>('systemDataAnalysisModel')

  useHistoryListener((location) => {
    const { pathname } = location
    if (pathname === '/system-data/analysis') {
      // 初始化数据
      dispatch.systemDataAnalysisModel.getAnalysisStatistics({})
      dispatch.systemDataAnalysisModel.getHourlyAnalysisTrend({})
      dispatch.systemDataAnalysisModel.getAnalysisTrend({ days: 30 })
      dispatch.systemDataAnalysisModel.getAnalysisTasks({ page: 1, pageSize: 10 })
    }
  })

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const hourlyChartRef = useRef<HTMLDivElement>(null)
  const dailyChartRef = useRef<HTMLDivElement>(null)
  const hourlyChartInstance = useRef<echarts.EChartsType | null>(null)
  const dailyChartInstance = useRef<echarts.EChartsType | null>(null)

  const handleDateRangeChange = (dates: [dayjs.Dayjs, dayjs.Dayjs] | null) => {
    setDateRange(dates)
    if (dates) {
      // 根据日期范围重新获取数据
      const startDate = dates[0].format('YYYY-MM-DD')
      const endDate = dates[1].format('YYYY-MM-DD')
      dispatch.systemDataAnalysisModel.getAnalysisTrend({ startDate, endDate })
    } else {
      // 如果清空日期范围，获取最近30天的数据
      dispatch.systemDataAnalysisModel.getAnalysisTrend({ days: 30 })
    }
  }

  // 刷新数据
  const handleRefresh = () => {
    dispatch.systemDataAnalysisModel.getAnalysisStatistics({})
    dispatch.systemDataAnalysisModel.getHourlyAnalysisTrend({})
    dispatch.systemDataAnalysisModel.getAnalysisTrend({ days: 30 })
    dispatch.systemDataAnalysisModel.getAnalysisTasks({ page, pageSize })
  }

  // 初始化24小时内图表
  // 注意：Card 的 loading 为 true 时会卸载图表容器 div，导致依赖 [hourlyChartData] 的
  // effect 在 div 重新挂载后不再触发，因此把 loading 也加入依赖，等加载结束容器存在时再初始化
  const hourlyChartLoading = loading.systemDataAnalysisModel.getHourlyAnalysisTrend
  useEffect(() => {
    if (hourlyChartRef.current && hourlyChartData && !hourlyChartLoading) {
      // 销毁之前的实例
      if (hourlyChartInstance.current) {
        hourlyChartInstance.current.dispose()
      }

      hourlyChartInstance.current = echarts.init(hourlyChartRef.current)

      const option = {
        tooltip: {
          trigger: 'axis',
        },
        legend: {
          data: ['查询次数', '查询人数'],
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: hourlyChartData.hours,
        },
        yAxis: {
          type: 'value',
        },
        series: [
          {
            name: '查询次数',
            type: 'line',
            data: hourlyChartData.queryCounts,
            smooth: true,
            lineStyle: {
              width: 2,
            },
          },
          {
            name: '查询人数',
            type: 'line',
            data: hourlyChartData.userCounts,
            smooth: true,
            lineStyle: {
              width: 2,
            },
          },
        ],
      }

      hourlyChartInstance.current.setOption(option)
    }

    return () => {
      if (hourlyChartInstance.current) {
        hourlyChartInstance.current.dispose()
        hourlyChartInstance.current = null
      }
    }
  }, [hourlyChartData, hourlyChartLoading])

  // 初始化每日图表
  // 同理，Card loading 会卸载容器 div，需要把 loading 加入依赖保证容器重新挂载后能初始化
  const dailyChartLoading = loading.systemDataAnalysisModel.getAnalysisTrend
  useEffect(() => {
    if (dailyChartRef.current && dailyChartData && dailyChartData.dates.length > 0 && !dailyChartLoading) {
      // 销毁之前的实例
      if (dailyChartInstance.current) {
        dailyChartInstance.current.dispose()
      }

      dailyChartInstance.current = echarts.init(dailyChartRef.current)

      const option = {
        tooltip: {
          trigger: 'axis',
        },
        legend: {
          data: ['查询次数', '查询人数'],
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: dailyChartData.dates,
        },
        yAxis: {
          type: 'value',
        },
        series: [
          {
            name: '查询次数',
            type: 'bar',
            data: dailyChartData.queryCounts,
            barWidth: '40%',
            itemStyle: {
              borderRadius: [2, 2, 0, 0],
            },
          },
          {
            name: '查询人数',
            type: 'bar',
            data: dailyChartData.userCounts,
            barWidth: '40%',
            itemStyle: {
              borderRadius: [2, 2, 0, 0],
            },
          },
        ],
      }

      dailyChartInstance.current.setOption(option)
    }

    return () => {
      if (dailyChartInstance.current) {
        dailyChartInstance.current.dispose()
        dailyChartInstance.current = null
      }
    }
  }, [dailyChartData, dailyChartLoading])

  // 窗口大小变化时重绘图表
  useEffect(() => {
    const handleResize = () => {
      if (hourlyChartInstance.current) {
        hourlyChartInstance.current.resize()
      }
      if (dailyChartInstance.current) {
        dailyChartInstance.current.resize()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // 组装统计数据
  const statisticData = statistics ? [
    { title: '查询次数', value: statistics.queryCount, icon: 'bar-chart' },
    { title: '查询人数', value: statistics.userCount, icon: 'user-group' },
    { title: '查询平均耗时', value: statistics.avgDuration, icon: 'clock-circle' },
    { title: '查询失败率', value: statistics.failureRate, icon: 'close-circle' },
    { title: '正在排队中任务数', value: statistics.queuedTasks, icon: 'hourglass' },
    { title: '计算中的任务数', value: statistics.processingTasks, icon: 'desktop' },
    { title: '已终止的任务数', value: statistics.terminatedTasks, icon: 'stop' },
    { title: '导出数据次数', value: statistics.exportCount, icon: 'download' },
    { title: '导出数据人数', value: statistics.exportUserCount, icon: 'user-group' },
  ] : []

  return (
    <div className={styles.container}>
      <PageHeader
        title="数分数据"
        onRefresh={handleRefresh}
        loading={loading.systemDataAnalysisModel.getAnalysisStatistics || loading.systemDataAnalysisModel.getHourlyAnalysisTrend}
        extra={
          <Button
            type="link"
            icon={<Help theme="outline" size="16" fill="currentColor" />}
            onClick={() => navigate('/guide/system-data/analysis')}
          >
            说明
          </Button>
        }
      />

      {/* 统计卡片区域 */}
      <Row gutter={[16, 16]} className={styles.statisticRow}>
        {statisticData.map((item, index) => (
          <Col xs={24} sm={12} md={8} lg={8} xl={8} key={index}>
            <Card className={styles.statisticCard}>
              <Statistic
                title={item.title}
                value={item.value}
                prefix={iconMap[item.icon]}
                valueStyle={{ color: statisticColorPalette[index % statisticColorPalette.length], fontSize: 16 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} className={styles.chartRow}>
        <Col span={24}>
          <Card
            title="24小时内分任务查看次数、人数图表"
            className={styles.card}
            loading={loading.systemDataAnalysisModel.getHourlyAnalysisTrend}
          >
            <div ref={hourlyChartRef} style={{ height: '300px', width: '100%' }} />
          </Card>
        </Col>
      </Row>

      {/* 历史数据查看 */}
      <Card
        title="历史数据查看"
        extra={
          <Space className={styles.datePickerContainer}>
            <span>日期选择:</span>
            <RangePicker onChange={handleDateRangeChange} size="small" />
          </Space>
        }
        className={styles.card}
        loading={loading.systemDataAnalysisModel.getAnalysisTrend}
      >
        <Row gutter={[16, 16]} className={styles.chartRow}>
          <Col span={24}>
            <div ref={dailyChartRef} style={{ height: '300px', width: '100%' }} />
          </Col>
        </Row>

        {/* 数据表格 */}
        <Row>
          <Col span={24}>
            <Table
              scroll={{ x: 'max-content' }}
              dataSource={taskList}
              columns={columns}
              className={styles.table}
              pagination={{
                total: total,
                current: page,
                pageSize: pageSize,
                showQuickJumper: true,
                showSizeChanger: true,
                onChange: (page, pageSize) => {
                  dispatch.systemDataAnalysisModel.getAnalysisTasks({ page, pageSize })
                },
              }}
              size="middle"
              loading={loading.systemDataAnalysisModel.getAnalysisTasks}
            />
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default Analysis
