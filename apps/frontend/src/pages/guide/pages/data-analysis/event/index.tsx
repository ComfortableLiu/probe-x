import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function EventGuide() {
  return (
    <Card>
      <GuideHeader title="事件分析说明" />
      <div className={styles.guideContent}>
        <h3>页面介绍</h3>
        <p>事件分析页面用于深入分析特定事件的触发情况，包括事件触发次数、触发用户数、事件属性分布等。</p>

        <h3>核心功能</h3>
        <ul>
          <li><strong>事件选择</strong>：支持选择单个或多个事件进行分析，可查看事件的详细定义和属性</li>
          <li><strong>全局筛选</strong>：支持对用户属性、事件属性进行筛选，可精确分析特定条件下的事件触发情况</li>
          <li><strong>数据维度分析</strong>：支持按不同维度（如时间、用户属性、事件属性等）进行分组，可查看不同维度下的事件分布情况</li>
          <li><strong>时间范围选择</strong>：支持自定义时间范围查询，默认显示最近7天的数据</li>
          <li><strong>数据表格展示</strong>：以表格形式展示详细的事件数据，支持排序、筛选等操作</li>
          <li><strong>数据导出</strong>：支持将分析结果导出为文件，支持异步导出任务</li>
        </ul>

        <h3>使用场景</h3>
        <ul>
          <li><strong>核心事件监控</strong>：监控关键业务事件（如购买、注册、分享等）的触发情况</li>
          <li><strong>用户行为分析</strong>：分析用户对特定功能的操作频率和习惯</li>
          <li><strong>异常事件排查</strong>：当某个事件触发异常时，通过事件分析定位问题</li>
          <li><strong>A/B测试效果评估</strong>：对比不同版本下事件触发率的差异</li>
          <li><strong>功能使用情况统计</strong>：统计新功能上线后的使用情况</li>
        </ul>

        <h3>典型应用示例</h3>
        <ul>
          <li>分析"购买"事件在最近一周的触发趋势</li>
          <li>对比不同地区用户对"分享"事件的使用情况</li>
          <li>分析"搜索"事件中不同关键词的分布情况</li>
          <li>监控"错误"事件的触发频率，及时发现系统问题</li>
        </ul>

        <h3>实际场景示例</h3>
        <div className={styles.scenarioBox}>
          <h4>场景一：核心购买事件监控</h4>
          <p><strong>业务背景：</strong>电商平台需要实时监控"购买"事件的触发情况，确保交易系统正常运行。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>选择事件："购买"</li>
            <li>时间范围：最近24小时</li>
            <li>按小时维度分组，查看购买事件的触发趋势</li>
            <li>全局筛选：订单金额 &gt; 100元（筛选大额订单）</li>
          </ol>
          <p><strong>分析结果：</strong>发现晚上8-10点是购买高峰期，触发次数占全天的35%，建议在此时间段增加服务器资源，确保系统稳定。</p>
        </div>

        <div className={styles.scenarioBox}>
          <h4>场景二：新功能使用情况统计</h4>
          <p><strong>业务背景：</strong>产品上线了"一键分享"新功能，需要统计功能上线一周后的使用情况。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>选择事件："分享"</li>
            <li>时间范围：最近7天</li>
            <li>按日期维度分组，查看每日分享次数</li>
            <li>按用户属性维度分组，对比新用户和老用户的使用差异</li>
            <li>查看事件属性"分享渠道"的分布情况</li>
          </ol>
          <p><strong>分析结果：</strong>新功能上线7天，累计触发12,345次，其中微信分享占68%，微博占22%，其他渠道占10%。新用户使用率（15.2%）高于老用户（8.5%），说明新功能对新用户更有吸引力。</p>
        </div>

        <div className={styles.scenarioBox}>
          <h4>场景三：搜索行为分析</h4>
          <p><strong>业务背景：</strong>内容平台需要分析用户的搜索行为，了解热门搜索词和搜索趋势。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>选择事件："搜索"</li>
            <li>时间范围：最近30天</li>
            <li>按事件属性"关键词"维度分组，统计各关键词的搜索次数</li>
            <li>全局筛选：搜索结果数 &gt; 0（排除无结果搜索）</li>
            <li>按地区维度分组，对比不同地区的搜索偏好</li>
          </ol>
          <p><strong>分析结果：</strong>发现"教程"、"攻略"类关键词搜索量最高，占搜索总量的42%，建议增加此类内容的推荐权重。一线城市的搜索活跃度是二三线城市的2.5倍。</p>
        </div>

        <div className={styles.scenarioBox}>
          <h4>场景四：异常事件排查</h4>
          <p><strong>业务背景：</strong>系统监控发现"支付失败"事件在某个时间段突然增加，需要快速定位问题。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>选择事件："支付失败"</li>
            <li>时间范围：问题发生的时间段（如：2024-11-15 14:00 - 16:00）</li>
            <li>按事件属性"失败原因"维度分组，查看失败原因分布</li>
            <li>按支付渠道维度分组，对比不同渠道的失败率</li>
            <li>查看事件属性"错误码"的分布情况</li>
          </ol>
          <p><strong>分析结果：</strong>发现14:30-15:00期间支付失败事件激增，其中"余额不足"占45%，"网络超时"占30%，"系统错误"占25%。定位到是第三方支付接口在高峰期响应变慢导致，立即联系支付服务商优化接口性能。</p>
        </div>
      </div>
    </Card>
  )
}

export default EventGuide
