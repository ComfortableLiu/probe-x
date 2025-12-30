import React, { useMemo } from "react"
import { Anchor, Col, Row } from "antd"
import * as styles from "./styles.module.scss"
import MetaEvent from "@pages/system-data/overview/components/MetaEvent"

function Overview() {

  // 内容
  const content = useMemo(() => [{
    title: '元事件',
    element: <MetaEvent />,
    key: 'meta-event',
  }, {
    title: '数分查询量',
    element: <div>数分查询量: 待接入数据</div>,
    key: 'data-analysis-query',
  }, {
    title: '系统处理能力',
    element: <div>QPS: 待接入数据</div>,
    key: 'system-qps',
  }, {
    title: '平均响应时间',
    element: <div>响应时间: 待接入数据</div>,
    key: 'avg-response-time',
  }, {
    title: '系统可用性',
    element: <div>可用性: 待接入数据</div>,
    key: 'system-availability',
  }, {
    title: '错误率',
    element: <div>错误率: 待接入数据</div>,
    key: 'error-rate',
  }, {
    title: '事件收集量',
    element: <div>收集量: 待接入数据</div>,
    key: 'event-collection-volume',
  }, {
    title: '实时数据处理',
    element: <div>处理量: 待接入数据</div>,
    key: 'real-time-processing',
  }], [])

  return (
    <Row className={styles.container}>
      <Col span={20} className={styles.content}>
        {/* 系统数据概览 */}
        {content.map(item => (
          <div
            id={item.key}
            key={item.key}
            style={{ height: 500 }}
          >
            <h3>{item.title}</h3>
            {item.element}
          </div>
        ))}
      </Col>
      <Col span={4}>
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
      </Col>
    </Row>
  )
}

export default Overview
