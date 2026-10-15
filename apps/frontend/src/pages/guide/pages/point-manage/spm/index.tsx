import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function SpmGuide() {
  return (
    <Card>
      <GuideHeader title="SPM 管理说明" />
      <div className={styles.guideContent}>
        <h3>SPM 表示什么</h3>
        <p>SPM 用于标识一次行为发生的页面位置，结构为 <code>A.B.C.D</code>，从业务到点位逐级定位。</p>
        <ul>
          <li><strong>A · 站点 / 业务</strong>：所属站点或业务线，在“基础编码”中维护。</li>
          <li><strong>B · 页面</strong>：该业务下的页面，例如首页或商品详情页。</li>
          <li><strong>C · 模块</strong>：该页面下的区域，例如推荐区或轮播区。</li>
          <li><strong>D · 点位</strong>：该模块中的具体交互位置，例如一个按钮或卡片位置。</li>
        </ul>

        <h3>新增与维护</h3>
        <ol>
          <li>先在“基础编码”中维护业务，再进入 SPM 管理选择“业务”。</li>
          <li>点击左列“新增页面”，填写名称与描述后保存。</li>
          <li>选择页面后，在中列“新增模块”；选择模块后，在右列“新增点位”。新增前应核对当前选中的父级。</li>
          <li>列表以“名称（编码）”展示节点。右键节点后选择“修改”，可以调整名称与描述；编辑时编码仅供查看。</li>
          <li>切换页面或模块时，下级选择会清空，重新选择后再继续操作。列表较长时在对应列内滚动加载后续节点，分栏宽度可拖动调整。</li>
        </ol>

        <h3>与埋点采集配合</h3>
        <p>节点维护完成后，需在实际页面或 SDK 埋点中使用对应编码。管理页保存节点只维护编码和说明，不会自动为业务页面添加采集代码，也不会生成事件。</p>
        <div className={styles.scenarioBox}>
          <h4>如何区分 SPM 与 SCM</h4>
          <p>同一个推荐位展示不同内容时，SPM 用于说明“点击发生在哪个位置”，SCM 用于说明“点击的是哪个来源、哪种配置方式下的内容”。两者可以一起用于记录来源。</p>
        </div>

        <h3>常见问题</h3>
        <ul>
          <li><strong>业务下拉为空</strong>：先检查基础编码中的业务配置。</li>
          <li><strong>模块或点位列表为空</strong>：先选中上一级；当前父级可能还没有下级节点，需要在对应列新增。</li>
          <li><strong>维护后分析页仍没有数据</strong>：编码字典与实际事件是两类数据，需继续确认上报是否携带编码、事件日期与最终清洗进度。</li>
        </ul>
      </div>
    </Card>
  )
}

export default SpmGuide
