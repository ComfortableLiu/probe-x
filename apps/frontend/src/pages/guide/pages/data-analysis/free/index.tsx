import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function FreeGuide() {
  return (
    <Card>
      <GuideHeader title="自由分析说明" />
      <div className={styles.guideContent}>
        <h3>页面介绍</h3>
        <p>自由分析页面是一个预留的自定义分析页面，允许用户根据业务需求进行灵活的数据分析。</p>

        <h3>核心功能</h3>
        <p>目前为占位页面，功能待开发。</p>

        <h3>使用场景</h3>
        <ul>
          <li>自定义数据分析需求</li>
          <li>复杂的数据分析场景</li>
          <li>临时性的数据分析任务</li>
        </ul>

        <h3>未来规划</h3>
        <ul>
          <li>支持自定义查询条件</li>
          <li>支持自定义可视化图表</li>
          <li>支持保存分析模板</li>
          <li>支持分享分析结果</li>
        </ul>
      </div>
    </Card>
  )
}

export default FreeGuide
