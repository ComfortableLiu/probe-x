import React, { useEffect, useRef, useState } from "react"
import { Card, Col, DatePicker, Row, Space, Statistic, Table } from "antd"
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
import * as mockData from './mockData'

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
  const [dateRange, setDateRange] = useState(null)
  const hourlyChartRef = useRef<HTMLDivElement>(null)
  const dailyChartRef = useRef<HTMLDivElement>(null)
  const hourlyChartInstance = useRef<echarts.EChartsType | null>(null)
  const dailyChartInstance = useRef<echarts.EChartsType | null>(null)

  const handleDateRangeChange = (dates) => {
    setDateRange(dates)
  }

  // 初始化24小时内图表
  useEffect(() => {
    if (hourlyChartRef.current) {
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
          data: mockData.mockHourlyChartData.hours,
        },
        yAxis: {
          type: 'value',
        },
        series: [
          {
            name: '查询次数',
            type: 'line',
            data: mockData.mockHourlyChartData.queryCounts,
            smooth: true,
            lineStyle: {
              width: 2,
            },
          },
          {
            name: '查询人数',
            type: 'line',
            data: mockData.mockHourlyChartData.userCounts,
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
      }
    }
  }, [])

  // 初始化每日图表
  useEffect(() => {
    if (dailyChartRef.current) {
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
          data: mockData.mockDailyChartData.dates,
        },
        yAxis: {
          type: 'value',
        },
        series: [
          {
            name: '查询次数',
            type: 'bar',
            data: mockData.mockDailyChartData.queryCounts,
            barWidth: '40%',
            itemStyle: {
              borderRadius: [2, 2, 0, 0],
            },
          },
          {
            name: '查询人数',
            type: 'bar',
            data: mockData.mockDailyChartData.userCounts,
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
      }
    }
  }, [])

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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>数分数据</h2>
      </div>

      {/* 统计卡片区域 */}
      <Row gutter={[8, 8]} className={styles.statisticRow}>
        {mockData.mockStatistics.map((item, index) => (
          <Col xs={24} sm={12} md={8} lg={8} xl={8} key={index}>
            <Card className={styles.statisticCard}>
              <Statistic
                title={item.title}
                value={item.value}
                prefix={iconMap[item.icon]}
                valueStyle={{ color: item.color, fontSize: 16 }}
                // titleStyle={{ fontSize: 12 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} className={styles.chartRow}>
        <Col span={24}>
          <Card title="24小时内分任务查看次数、人数图表" className={styles.card}>
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
              dataSource={mockData.mockTaskData}
              columns={columns}
              className={styles.table}
              pagination={{
                pageSize: 5,
                showQuickJumper: true,
                showSizeChanger: true,
              }}
              size="middle"
            />
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default Analysis
