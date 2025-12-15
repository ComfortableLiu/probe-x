import React, { useEffect, useRef } from "react"
import { Card, Col, Progress, Row, Statistic } from "antd"
import * as styles from "./styles.module.scss"
import * as echarts from "echarts"

function Meta() {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (chartRef.current) {
      chartInstance.current = echarts.init(chartRef.current)

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
            data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
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
            data: [1000, 1200, 1100, 1300, 1500, 1400, 1600],
            itemStyle: {
              color: '#536DFE',
            },
          },
        ],
      }

      chartInstance.current.setOption(option)

      const handleResize = () => {
        chartInstance.current?.resize()
      }

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
        chartInstance.current?.dispose()
      }
    }
  }, [])

  return (
    <div className={styles.container}>
      <h2>元数据</h2>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="原始数据总量"
              value="123M"
              valueStyle={{ color: '#3f8cff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="最终清洗数据量"
              value="567M"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="初次清洗成功率"
              value="99.99%"
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
              value="99.99%"
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="上报数据量趋势">
            <div ref={chartRef} style={{ height: '400px', width: '100%' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="初次数据清洗">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>清洗成功率</span>
                  <span>99.99%</span>
                </div>
                <Progress percent={99.99} strokeColor="#52c41a" />
              </div>

              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title="清洗成功数">
                    <Statistic value="123M" />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="清洗失败数">
                    <Statistic value="123k" valueStyle={{ color: '#ff4d4f' }} />
                  </Card>
                </Col>
              </Row>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="最终数据清洗">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>清洗成功率</span>
                  <span>99.99%</span>
                </div>
                <Progress percent={99.99} strokeColor="#52c41a" />
              </div>

              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title="清洗成功数">
                    <Statistic value="567M" />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="清洗失败数">
                    <Statistic value="567k" valueStyle={{ color: '#ff4d4f' }} />
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

export default Meta
