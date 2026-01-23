import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function DashboardConfigGuide() {
  return (
    <Card>
      <GuideHeader title="数据看板设置说明" />
      <div className={styles.guideContent}>
        <h3>页面介绍</h3>
        <p>数据看板设置页面用于配置和管理数据分析看板，允许用户自定义看板布局和展示内容。</p>

        <h3>核心功能</h3>
        <p>目前为占位页面，功能待开发。</p>

        <h3>使用场景</h3>
        <ul>
          <li>创建自定义数据看板</li>
          <li>配置看板展示的数据指标</li>
          <li>管理多个数据看板</li>
          <li>分享数据看板给团队成员</li>
        </ul>

        <h3>未来规划</h3>
        <ul>
          <li>支持拖拽式看板布局</li>
          <li>支持多种图表类型</li>
          <li>支持看板模板</li>
          <li>支持看板权限管理</li>
        </ul>
      </div>
    </Card>
  )
}

export default DashboardConfigGuide
