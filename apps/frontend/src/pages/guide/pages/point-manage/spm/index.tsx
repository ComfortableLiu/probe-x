import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function SpmGuide() {
  return (
    <Card>
      <GuideHeader title="SPM管理说明" />
      <div className={styles.guideContent}>
        <h3>SPM管理说明</h3>
        <p>SPM 用于唯一标识页面及模块，结构为 <strong>A.B.C.D</strong>：</p>
        <ul>
          <li><strong>A（站点/业务）</strong>：表示站点/业务，通常用作多地区（通常为多国家）运营，或多业务线，比如美国站、业务A</li>
          <li><strong>B（页面）</strong>：表示页面，每个页面拥有唯一 Id，比如首页</li>
          <li><strong>C（模块）</strong>：表示模块，同页面范围内，每一个模块都拥有唯一 Id，比如轮播图模块</li>
          <li><strong>D（点位）</strong>：表示点位，一个模块内的点位 Id，比如轮播图模块中的第1张图</li>
        </ul>
        <p style={{ marginTop: 16, color: 'var(--px-color-text-secondary)' }}>
          <strong>注意：</strong>站点/业务（A）不在这里维护，请在<strong>基础编码</strong>中进行维护。
        </p>
      </div>
    </Card>
  )
}

export default SpmGuide
