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
  },{
    title: '数分查询量',
    element: <MetaEvent />,
    key: 'meta-event',
  }], [])

  return (
    <Row className={styles.container}>
      <Col span={20} className={styles.content}>
        {/* 元事件数据 */}
        {content.map(item => (
          <div
            id="meta-event"
            key={item.key}
            style={{ height: 2000 }}
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
