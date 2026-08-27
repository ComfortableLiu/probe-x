import React from "react"
import { useNavigate } from "react-router-dom"
import { Card, Row, Col, Typography, Space, Divider } from "antd"
import { 
  FileTextOutlined, 
  BarChartOutlined, 
  DatabaseOutlined,
  SettingOutlined,
  ApiOutlined,
  CloudServerOutlined
} from "@ant-design/icons"
import * as styles from "../styles.module.scss"

const { Title, Paragraph } = Typography

function GuideIndex() {
  const navigate = useNavigate()
  
  const categories = [
    {
      title: '数据分析',
      description: '了解各种数据分析功能的使用方法和应用场景',
      items: [
        { name: '漏斗分析', path: '/guide/data-analysis/funnel' },
        { name: '事件分析', path: '/guide/data-analysis/event' },
        { name: '用户路径分析', path: '/guide/data-analysis/user-path' },
        { name: '归因分析', path: '/guide/data-analysis/attribution' },
        { name: '数据看板设置', path: '/guide/data-analysis/dashboard-config' },
      ],
    },
    {
      title: '系统数据',
      description: '系统运行状态监控和数据分析',
      items: [
        { name: '系统数据总览', path: '/guide/system-data/overview' },
        { name: '系统数据分析', path: '/guide/system-data/analysis' },
      ],
    },
    {
      title: '点位管理',
      description: 'SPM和SCM点位管理说明',
      items: [
        { name: 'SPM管理', path: '/guide/point-manage/spm' },
        { name: 'SCM管理', path: '/guide/point-manage/scm' },
      ],
    },
  ]

  const systemFeatures = [
    {
      icon: <BarChartOutlined style={{ fontSize: 24, color: 'var(--px-color-primary)' }} />,
      title: '数据分析',
      description: '提供漏斗分析、事件分析、用户路径分析、归因分析等多种数据分析能力，帮助您深入了解用户行为和业务转化情况。',
    },
    {
      icon: <DatabaseOutlined style={{ fontSize: 24, color: 'var(--px-color-success)' }} />,
      title: '点位管理',
      description: '支持SPM和SCM点位管理，帮助您规范和管理埋点数据，确保数据采集的准确性和一致性。',
    },
    {
      icon: <SettingOutlined style={{ fontSize: 24, color: 'var(--px-color-warning)' }} />,
      title: '系统配置',
      description: '提供用户管理、角色权限、系统参数等配置功能，支持灵活的权限控制和系统定制。',
    },
    {
      icon: <CloudServerOutlined style={{ fontSize: 24, color: 'var(--px-color-primary-active)' }} />,
      title: '实时处理',
      description: '基于Kafka消息队列的实时数据处理管道，支持大规模埋点数据的实时收集、处理和清洗。',
    },
  ]

  return (
    <div className={styles.guideContent}>
      {/* 系统概述 */}
      <Card style={{ marginBottom: 32, background: 'linear-gradient(135deg, var(--px-color-primary) 0%, var(--px-color-primary-active) 100%)', border: 'none' }}>
        <div style={{ color: '#fff' }}>
          <Title level={3} style={{ color: '#fff', marginBottom: 16 }}>
            Probe-X 数据分析平台
          </Title>
          <Paragraph style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 16, lineHeight: 1.8, marginBottom: 0 }}>
            Probe-X 是一个现代化的Web数据分析解决方案，基于微服务架构的埋点与数据分析系统。
            系统采用事件驱动架构，通过Kafka消息队列实现异步数据处理，支持大规模埋点数据的实时收集、处理、清洗和分析。
            通过强大的数据分析工具和灵活的配置管理，帮助您深入了解用户行为，优化产品体验，提升业务转化。
          </Paragraph>
        </div>
      </Card>

      {/* 核心功能 */}
      <div style={{ marginBottom: 32 }}>
        <Title level={3} style={{ marginBottom: 24 }}>核心功能</Title>
        <Row gutter={[24, 24]}>
          {systemFeatures.map((feature, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <Card className={styles.featureCard} hoverable>
                <Space direction="vertical" size="middle" style={{ width: '100%', textAlign: 'center' }}>
                  <div>{feature.icon}</div>
                  <Title level={4} style={{ margin: 0, fontSize: 16 }}>
                    {feature.title}
                  </Title>
                  <Paragraph style={{ margin: 0, color: 'var(--px-color-text-secondary)', lineHeight: 1.6, fontSize: 14 }}>
                    {feature.description}
                  </Paragraph>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* 系统架构简介 */}
      <Card style={{ marginBottom: 32 }}>
        <Title level={3} style={{ marginBottom: 16 }}>
          <ApiOutlined style={{ marginRight: 8 }} />
          系统架构
        </Title>
        <Paragraph style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--px-color-text-secondary)' }}>
          Probe-X 采用微服务架构，主要包含以下服务组件：
        </Paragraph>
        <ul style={{ fontSize: 15, lineHeight: 2, color: 'var(--px-color-text-secondary)', paddingLeft: 24 }}>
          <li><strong>前端服务</strong>：React + TypeScript 数据可视化界面，提供数据分析和埋点管理功能</li>
          <li><strong>埋点接收服务</strong>：接收和存储原始埋点数据，通过Kafka转发给数据处理服务</li>
          <li><strong>数据仪表板API服务</strong>：提供前端管理页面的API接口，包括数据分析、埋点管理等</li>
          <li><strong>初步数据处理服务</strong>：数据初步补充，包括Session切割、UTM参数补充、SPM/SCM翻译等</li>
          <li><strong>最终数据清洗服务</strong>：深度数据清洗，主要清洗归因数据</li>
        </ul>
        <Paragraph style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--px-color-text-secondary)', marginTop: 16 }}>
          <strong>数据流：</strong>前端埋点 → 埋点接收服务 → Kafka → 初步数据处理服务 → Kafka → 最终数据清洗服务 → 数据存储 → 数据仪表板API服务 → 前端仪表板
        </Paragraph>
      </Card>

      <Divider />

      {/* 功能导航 */}
      <div>
        <Title level={3} style={{ marginBottom: 24 }}>功能导航</Title>
        <Paragraph style={{ fontSize: 16, color: 'var(--px-color-text-secondary)', marginBottom: 24 }}>
          点击下方卡片中的链接，查看各功能模块的详细说明和使用指南。
        </Paragraph>
        <Row gutter={[24, 24]}>
          {categories.map((category, index) => (
            <Col xs={24} sm={12} lg={8} key={index}>
              <Card
                title={
                  <Space>
                    <FileTextOutlined />
                    {category.title}
                  </Space>
                }
                className={styles.categoryCard}
              >
                <Paragraph style={{ color: 'var(--px-color-text-secondary)', marginBottom: 16 }}>
                  {category.description}
                </Paragraph>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {category.items.map((item, itemIndex) => (
                    <li key={itemIndex} style={{ marginBottom: 8 }}>
                      <a
                        href={item.path}
                        onClick={(e) => {
                          e.preventDefault()
                          navigate(item.path)
                        }}
                        style={{ color: 'var(--px-color-primary)', cursor: 'pointer' }}
                      >
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  )
}

export default GuideIndex
