import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function DashboardConfigGuide() {
  return (
    <Card>
      <GuideHeader title="看板设置说明" />
      <div className={styles.guideContent}>
        <h3>看板如何创建</h3>
        <p>看板保存可复用的分析配置，并在首页展示对应结果。支持事件、漏斗、用户路径、归因及 UTM 分析。</p>
        <ol>
          <li>进入对应的数据分析页面，选择事件、指标、维度与筛选条件，先查询并核对结果。</li>
          <li>点击“保存为看板”，填写名称并设置图表、表格的展示选项，保存后可在首页查看。</li>
          <li>进入“看板设置”，按看板类型、分析类型等条件查找已有看板。这里的“创建看板指引”会引导你到分析页面完成配置。</li>
        </ol>

        <h3>编辑、共享与删除</h3>
        <ul>
          <li><strong>编辑</strong>：点击列表中的“编辑”进入对应分析页面，调整配置后通过“保存模板”更新已有看板。</li>
          <li><strong>个人看板</strong>：由创建者查看和管理；保存分析配置时默认创建个人看板。</li>
          <li><strong>公共看板</strong>：个人看板创建者可将其转为公共看板，并设置可查看的角色；角色留空时，所有用户可查看。转为公共后，由管理员维护编辑和删除。</li>
          <li><strong>删除</strong>：删除看板会移除这份配置及其首页展示，不会删除原始事件或最终清洗数据。具体操作以当前账号权限为准。</li>
        </ul>

        <h3>首页日期与刷新</h3>
        <ul>
          <li><strong>全局时间</strong>：首页顶部选择的日期默认作用于全部看板。</li>
          <li><strong>单独设置时间</strong>：卡片可覆盖全局日期，或恢复“跟随全局”；修改全局时间时，单独设置的卡片仍使用自己的时间。</li>
          <li><strong>查看详情</strong>：打开对应分析页，并携带该卡片当前生效的日期范围与分析配置，便于继续核对结果。</li>
          <li><strong>自动刷新</strong>：首页每 60 秒刷新看板数据；相对日期会在查询时重新计算。刷新不会触发数据清洗，最新结果仍受清洗进度影响。</li>
          <li><strong>排序与记忆</strong>：首页支持拖动卡片调整顺序，排序保存在当前浏览器；日期选择也会在当前浏览器恢复，并可由页面 URL 中的设置覆盖。</li>
        </ul>

        <h3>常见问题</h3>
        <ul>
          <li><strong>首页没有看到刚保存的看板</strong>：刷新首页列表，检查当前账号是否拥有该看板的查看权限。</li>
          <li><strong>看板与分析页结果不同</strong>：先核对卡片是否单独设置了时间，再用“查看详情”进入，确认日期、指标和筛选一致，并等待数据刷新。</li>
          <li><strong>编辑或删除入口不可用</strong>：个人看板和公共看板的管理权限不同，转为公共后需由管理员维护。</li>
        </ul>
      </div>
    </Card>
  )
}

export default DashboardConfigGuide
