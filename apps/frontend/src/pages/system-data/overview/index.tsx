import React, { useEffect, useMemo } from "react"
import { Anchor, Col, Row, Spin } from "antd"
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
    computingNodeStatus,
    systemPerformanceMetrics,
    eventCollectionMetrics,
    realTimeProcessingMetrics,
    metaOverview,
    loading,
  } = useModel<ISystemDataOverviewWithMetaState>('systemDataOverviewModel')

  const dispatch = useDispatch<Dispatch>()

  useEffect(() => {
    dispatch.systemDataOverviewModel.fetchSystemDataOverview()
  }, [])

  // 刷新数据
  const handleRefresh = () => {
    dispatch.systemDataOverviewModel.fetchSystemDataOverview()
  }

  // 内容
  const content = useMemo(() => [{
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
      <DataAnalysisQuery eventCollectionMetrics={eventCollectionMetrics} />
    ),
    key: 'data-analysis-query',
  }, {
    title: '系统处理能力',
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
    title: '系统可用性',
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
  }], [computingNodeStatus, systemPerformanceMetrics, eventCollectionMetrics, realTimeProcessingMetrics, metaOverview])

  return (
    <div className={styles.container}>
      <PageHeader
        title="系统数据总览"
        onRefresh={handleRefresh}
        loading={loading}
      />
      <Spin spinning={loading}>
        <Row>
          <Col span={20} className={styles.content}>
            {/* 系统数据概览 */}
            {content.map(item => (
              <div
                id={item.key}
                key={item.key}
                className={styles.section}
              >
                <h3 className={styles.sectionTitle}>{item.title}</h3>
                {item.element}
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
      </Spin>
    </div>
  )
}

export default Overview
