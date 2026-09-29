import ServiceResources from './components/ServiceResources'
import React, { useEffect, useMemo } from "react"
import { Anchor, Col, Row, Spin, Button, theme, Alert, Typography } from "antd"
import { Help } from "@icon-park/react"
import { useNavigate } from "react-router-dom"
import PageHeader from "@components/PageHeader"
import * as styles from "./styles.module.scss"
import MetaEvent from "@pages/system-data/overview/components/MetaEvent"
import ComputingNodeStatus from "@pages/system-data/overview/components/ComputingNodeStatus"
import DataAnalysisQuery from "@pages/system-data/overview/components/DataAnalysisQuery"
import SystemPerformance from "@pages/system-data/overview/components/SystemPerformance"
import AvgResponseTime from "@pages/system-data/overview/components/AvgResponseTime"
import SystemAvailability from "@pages/system-data/overview/components/SystemAvailability"
import ErrorRate from "@pages/system-data/overview/components/ErrorRate"
import EventCollectionVolume from "@pages/system-data/overview/components/EventCollectionVolume"
import RealTimeProcessing from "@pages/system-data/overview/components/RealTimeProcessing"
import { useModel } from "@/hooks"
import { Dispatch } from "@/store/storeContext"
import { useDispatch } from "react-redux"
import { ISystemDataOverviewWithMetaState } from "@pages/system-data/overview/type"

function Overview() {
  const {
    serviceResources,
    computingNodeStatus,
    systemPerformanceMetrics,
    eventCollectionMetrics,
    realTimeProcessingMetrics,
    metaOverview,
    analysisQueryMetrics,
    updatedAt,
    warnings,
    error,
    loading,
  } = useModel<ISystemDataOverviewWithMetaState>('systemDataOverviewModel')

  const dispatch = useDispatch<Dispatch>()
  const navigate = useNavigate()
  const { token } = theme.useToken()

  useEffect(() => {
    dispatch.systemDataOverviewModel.fetchSystemDataOverview()
    const timer = window.setInterval(() => {
      if (!document.hidden) dispatch.systemDataOverviewModel.fetchSystemDataOverview()
    }, 30000)
    return () => window.clearInterval(timer)
  }, [dispatch])

  // 刷新数据
  const handleRefresh = () => {
    dispatch.systemDataOverviewModel.fetchSystemDataOverview()
  }

  // 内容
  const content = useMemo(() => [{
    title: '各服务资源',
    element: <ServiceResources serviceResources={serviceResources} />,
    key: 'service-resources',
  }, {
    title: '元事件',
    element: (
      <MetaEvent
        metaOverview={metaOverview}
        eventCollectionMetrics={eventCollectionMetrics}
      />
    ),
    key: 'meta-event',
  }, {
    title: '计算节点状态',
    element: (
      <ComputingNodeStatus computingNodeStatus={computingNodeStatus} />
    ),
    key: 'computing-node-status',
  }, {
    title: '数分查询量',
    element: (
      <DataAnalysisQuery analysisQueryMetrics={analysisQueryMetrics} />
    ),
    key: 'data-analysis-query',
  }, {
    title: 'API 请求吞吐',
    element: (
      <SystemPerformance systemPerformanceMetrics={systemPerformanceMetrics} />
    ),
    key: 'system-qps',
  }, {
    title: '平均响应时间',
    element: (
      <AvgResponseTime systemPerformanceMetrics={systemPerformanceMetrics} />
    ),
    key: 'avg-response-time',
  }, {
    title: 'API 请求成功率',
    element: (
      <SystemAvailability systemPerformanceMetrics={systemPerformanceMetrics} />
    ),
    key: 'system-availability',
  }, {
    title: '错误率',
    element: (
      <ErrorRate systemPerformanceMetrics={systemPerformanceMetrics} />
    ),
    key: 'error-rate',
  }, {
    title: '事件收集量',
    element: (
      <EventCollectionVolume eventCollectionMetrics={eventCollectionMetrics} />
    ),
    key: 'event-collection-volume',
  }, {
    title: '实时数据处理',
    element: (
      <RealTimeProcessing realTimeProcessingMetrics={realTimeProcessingMetrics} />
    ),
    key: 'real-time-processing',
  }], [serviceResources, computingNodeStatus, systemPerformanceMetrics, eventCollectionMetrics, realTimeProcessingMetrics, metaOverview, analysisQueryMetrics])

  return (
    <div className={styles.container}>
      <PageHeader
        title="系统数据总览"
        onRefresh={handleRefresh}
        loading={loading}
        extra={
          <Button
            type="link"
            icon={<Help theme="outline" size="16" fill={token.colorText} />}
            onClick={() => navigate('/guide/system-data/overview')}
          >
            说明
          </Button>
        }
      />
      <Typography.Paragraph type="secondary">
        每 30 秒刷新 · 时区：Asia/Shanghai · {updatedAt ? `数据时间：${new Date(updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}` : '等待首次数据'}
        <br />
        API 指标统计仪表板服务请求（不含总览轮询）。无样本或采集不可用时显示“—”；请求成功率不代表服务在线时长。
      </Typography.Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      {!!warnings?.length && <Alert type="warning" showIcon message={warnings.join('；')} style={{ marginBottom: 16 }} />}
      <Row>
        <Col span={20} className={styles.content}>
          {/* 系统数据概览，每个模块区块独立 loading */}
          {content.map(item => (
            <div
              id={item.key}
              key={item.key}
              className={styles.section}
            >
              <h3 className={styles.sectionTitle}>{item.title}</h3>
              <Spin spinning={loading}>
                {item.element}
              </Spin>
            </div>
          ))}
        </Col>
        <Col span={4}>
          <div style={{ position: 'sticky', top: 24 }}>
            <Anchor
              replace
              offsetTop={24}
              getContainer={() => document.querySelector('main')}
              items={content.map(item => ({
                key: item.key,
                href: `#${item.key}`,
                title: item.title,
              }))}
            />
          </div>
        </Col>
      </Row>
    </div>
  )
}

export default Overview
