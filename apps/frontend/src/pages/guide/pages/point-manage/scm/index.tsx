import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function ScmGuide() {
  return (
    <Card>
      <GuideHeader title="SCM 管理说明" />
      <div className={styles.guideContent}>
        <h3>SCM 表示什么</h3>
        <p>SCM 用于标识内容来源和配置方式，结构为 <code>A.B.C.D</code>，与描述页面位置的 SPM 配合使用。</p>
        <ul>
          <li><strong>A · 内容来源</strong>：内容从哪里来，例如运营后台。</li>
          <li><strong>B · 配置方式</strong>：内容如何配置，例如人工配置或系统生成。</li>
          <li><strong>C · 内容类型</strong>：内容属于什么类型，例如图片或超链接。</li>
          <li><strong>D · 内容 ID</strong>：对应具体内容。</li>
        </ul>

        <h3>新增与维护</h3>
        <ol>
          <li>从左侧 A 列开始，点击“新增A”，填写内容来源的名称与描述。</li>
          <li>选中 A 后新增 B；选中 B 后新增 C；选中 C 后新增 D。每次新增都先确认所属父级。</li>
          <li>点击节点逐级查看下级及当前节点信息；右键节点选择“修改”，调整名称与描述。编辑时编码仅供查看。</li>
          <li>切换上级后，下级选择会重置；长列表在各列内独立滚动加载，可拖动分隔线调整列宽。</li>
        </ol>

        <h3>编码如何用于分析</h3>
        <p>在内容配置或埋点上报中使用实际的 SCM 编码，才能把行为与来源、配置方式、内容类型和内容关联。管理页中的名称与描述用于解释编码，新增节点本身不会产生曝光或点击数据。</p>
        <div className={styles.scenarioBox}>
          <h4>配置示例：同一位置展示不同内容</h4>
          <p>页面中同一个推荐位可保持位置编码 SPM 一致，并用不同 SCM 标识实际内容。在查询中结合已采集的来源属性，区分位置表现与内容表现；实际可用的分析维度以采集和属性配置为准。</p>
        </div>

        <h3>常见问题</h3>
        <ul>
          <li><strong>下一列没有节点</strong>：先选中对应父级；若该父级尚未配置下级，在下一列新增。</li>
          <li><strong>同名节点是否代表同一内容</strong>：应以编码及所属父级判断，名称只用于说明，不要仅凭显示名称拼接来源。</li>
          <li><strong>保存 SCM 后没有分析数据</strong>：检查实际事件是否携带正确编码、对应属性是否可查询，以及数据是否已完成最终清洗。</li>
        </ul>
      </div>
    </Card>
  )
}

export default ScmGuide
