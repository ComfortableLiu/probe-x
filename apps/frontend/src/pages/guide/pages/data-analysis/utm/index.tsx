import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function UtmGuide() {
  return (
    <Card>
      <GuideHeader title="UTM 分析说明" />
      <div className={styles.guideContent}>
        <h3>用来解决什么问题</h3>
        <p>按投放链接携带的 UTM 参数比较流量，查看各来源、媒介、活动、关键词或素材带来的事件数、用户数与会话数。分析基于最终清洗结果。</p>

        <h3>完成一次查询</h3>
        <ol>
          <li>从来源（utm_source）、媒介（utm_medium）、活动（utm_campaign）、关键词（utm_term）、内容（utm_content）中选择 1 至 5 个分组维度。</li>
          <li>选择数据指标：事件数、用户数或会话数，可多选。第一个选中的指标决定表格排序与趋势图纵轴。</li>
          <li>按需增加 UTM 取值筛选：精确匹配可搜索取值或别名并多选；正则匹配用于匹配一组命名相近的取值。</li>
          <li>设置全局筛选与时间范围，点击“查询”。修改配置后需重新查询，结果区保持上一次查询的数据与条件。</li>
        </ol>

        <h3>如何理解结果</h3>
        <ul>
          <li><strong>组合分组</strong>：只选来源时每个来源一行；同时选择来源与媒介时，每种来源、媒介组合单独一行。</li>
          <li><strong>趋势图</strong>：展示按天的合计趋势及主要指标排名前 10 的分组；汇总表展示整个查询区间的各组合统计。</li>
          <li><strong>用户数与会话数</strong>：在对应统计范围内去重。同一用户可能出现在多天或多个组合中，分组去重数相加不一定等于整体去重数。</li>
          <li><strong>正则匹配</strong>：使用 RE2 语法，默认部分匹配；例如 <code>^spring_</code> 匹配以 spring_ 开头的原始取值，<code>^google$</code> 只匹配完整的 google。不支持前瞻、后顾与后向引用。</li>
        </ul>

        <h3>与 UTM 管理的关系</h3>
        <ul>
          <li><strong>别名</strong>：UTM 管理中维护的别名用于辅助展示和搜索，统计与取值筛选仍以原始 UTM 值为准。</li>
          <li><strong>软删除</strong>：某个 UTM 取值被软删除后，带有该取值的事件会从 UTM 分析中排除，即使此次未按那个维度分组。误删时可在 UTM 管理的已删除列表中恢复，再重新查询。</li>
          <li><strong>统计口径</strong>：UTM 管理的累计事件数来自初步处理后的事件记录，本页使用最终清洗结果，两页数量不必相等。</li>
        </ul>

        <h3>保存与导出</h3>
        <p>可将当前配置保存为首页看板，也可提交异步导出任务获取 Excel 文件。</p>

        <h3>常见问题</h3>
        <ul>
          <li><strong>某个投放活动没有数据</strong>：确认链接实际携带 UTM 参数、上报保留了原始取值、日期范围正确且数据完成最终清洗；再检查取值是否被软删除。</li>
          <li><strong>搜索到别名却筛选不到数据</strong>：核对别名对应的原始值和维度，尤其注意命名与大小写，避免把展示名称当成实际参数值。</li>
          <li><strong>流量最高的渠道是否效果最好</strong>：本页展示流量规模；评估转化贡献可继续查看归因分析，预算决策还需结合成本数据。</li>
        </ul>
      </div>
    </Card>
  )
}

export default UtmGuide
