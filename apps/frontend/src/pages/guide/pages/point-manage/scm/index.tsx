import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function ScmGuide() {
  return (
    <Card>
      <GuideHeader title="SCM管理说明" />
      <div className={styles.guideContent}>
        <h3>SCM管理说明</h3>
        <p>SCM 用于标识内容来源和配置方式，结构为 <strong>A.B.C.D</strong>：</p>
        <ul>
          <li><strong>A（内容来源）</strong>：标识内容来源 ID，用来标识内容是从哪里来的，如：运营后台</li>
          <li><strong>B（配置方式）</strong>：标识配置方式 ID，用来标识是用什么方式进行配置的，如：人工配置、系统生成</li>
          <li><strong>C（内容类型）</strong>：标识内容类型 ID，用来标识内容的类型，如：跳转列表的图片、跳转活动的超链接</li>
          <li><strong>D（内容ID）</strong>：标识内容 ID，用来唯一标识当前的内容</li>
        </ul>
      </div>
    </Card>
  )
}

export default ScmGuide
