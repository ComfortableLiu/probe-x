import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function AttributionGuide() {
  return (
    <Card>
      <GuideHeader title="归因分析说明" />
      <div className={styles.guideContent}>
        <h3>页面介绍</h3>
        <p>归因分析页面用于分析转化事件的归因情况，帮助理解哪些营销渠道或用户行为对转化产生了贡献。</p>

        <h3>核心功能</h3>
        <ul>
          <li><strong>归因模型选择</strong>：支持多种归因模型
            <ul>
              <li>首次触达归因（First Touch）：将转化归因于用户首次接触的渠道</li>
              <li>末次触达归因（Last Touch）：将转化归因于用户最后接触的渠道</li>
              <li>线性归因（Linear）：将转化平均分配给所有接触点</li>
              <li>时间衰减归因（Time Decay）：根据时间距离分配权重</li>
              <li>位置归因（Position Based）：给首次和末次接触点更高权重</li>
            </ul>
          </li>
          <li><strong>转化指标配置</strong>：支持选择转化目标事件（如购买、注册等），可配置转化指标的维度分析</li>
          <li><strong>归因事件配置</strong>：支持选择归因事件（如广告点击、页面浏览等），可配置归因事件的维度分析</li>
          <li><strong>全局筛选</strong>：支持对用户属性、事件属性进行筛选，可精确分析特定条件下的归因情况</li>
          <li><strong>时间范围选择</strong>：支持自定义时间范围查询，默认显示最近7天的数据</li>
          <li><strong>数据表格展示</strong>：以表格形式展示归因分析结果，支持按不同维度查看归因数据</li>
          <li><strong>数据导出</strong>：支持将归因分析结果导出为文件</li>
        </ul>

        <h3>使用场景</h3>
        <ul>
          <li><strong>营销渠道效果评估</strong>：评估不同营销渠道对转化的贡献度</li>
          <li><strong>广告投放优化</strong>：了解哪些广告渠道带来了实际转化，优化广告投放策略</li>
          <li><strong>用户获取分析</strong>：分析新用户的来源渠道，优化用户获取策略</li>
          <li><strong>ROI计算</strong>：结合成本数据，计算不同渠道的ROI</li>
          <li><strong>多触点归因</strong>：理解用户转化过程中的多触点贡献</li>
        </ul>

        <h3>典型应用示例</h3>
        <ul>
          <li>分析"购买"转化在不同营销渠道（如搜索引擎、社交媒体、直接访问）的归因情况</li>
          <li>使用首次触达归因，了解哪些渠道带来了新用户</li>
          <li>使用末次触达归因，了解哪些渠道促成了最终转化</li>
          <li>对比不同归因模型下的渠道贡献差异，制定更全面的营销策略</li>
        </ul>

        <h3>实际场景示例</h3>
        <div className={styles.scenarioBox}>
          <h4>场景一：新用户获取渠道分析</h4>
          <p><strong>业务背景：</strong>产品需要分析新用户的来源渠道，评估不同营销渠道的用户获取效果。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>选择归因模型："首次触达归因"</li>
            <li>转化指标：选择"注册成功"事件</li>
            <li>归因事件：选择"广告点击"、"搜索访问"、"社交媒体访问"等</li>
            <li>时间范围：最近30天</li>
            <li>全局筛选：用户类型 = "新用户"</li>
          </ol>
          <p><strong>分析结果：</strong>发现搜索引擎带来了45%的新用户，社交媒体带来28%，直接访问带来15%，其他渠道12%。结合各渠道的获客成本，计算出搜索引擎的ROI最高（1:3.2），建议增加搜索引擎广告投入。</p>
        </div>

        <div className={styles.scenarioBox}>
          <h4>场景二：付费转化归因分析</h4>
          <p><strong>业务背景：</strong>SaaS产品需要分析付费转化的归因情况，了解哪些渠道真正促成了付费转化。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>选择归因模型："末次触达归因"</li>
            <li>转化指标：选择"购买会员"事件</li>
            <li>归因事件：选择"官网访问"、"内容营销访问"、"广告点击"等</li>
            <li>时间范围：最近90天</li>
            <li>按归因事件维度分组，查看各渠道的转化贡献</li>
          </ol>
          <p><strong>分析结果：</strong>发现虽然搜索引擎带来了最多的新用户，但"内容营销"（博客、白皮书）促成了最多的付费转化（38%），其次是"官网直接访问"（25%）。说明内容营销虽然获客慢，但转化质量高。建议增加内容营销投入，同时优化官网的转化流程。</p>
        </div>

        <div className={styles.scenarioBox}>
          <h4>场景三：多触点归因分析</h4>
          <p><strong>业务背景：</strong>电商平台需要理解用户购买过程中的多触点贡献，全面评估营销效果。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>选择归因模型："线性归因"（平均分配）</li>
            <li>转化指标：选择"支付成功"事件</li>
            <li>归因事件：选择所有营销触点（广告点击、邮件打开、App推送点击等）</li>
            <li>时间范围：最近30天</li>
            <li>对比"首次触达"、"末次触达"、"线性归因"三种模型的结果</li>
          </ol>
          <p><strong>分析结果：</strong>首次触达归因显示搜索引擎贡献最大（42%），末次触达归因显示App推送贡献最大（35%），线性归因显示各渠道贡献相对均衡。综合分析发现，用户购买通常需要3-5个触点，建议建立全渠道营销策略，而非过度依赖单一渠道。</p>
        </div>

        <div className={styles.scenarioBox}>
          <h4>场景四：营销活动ROI计算</h4>
          <p><strong>业务背景：</strong>公司投入了多个营销活动，需要计算各活动的ROI，为后续预算分配提供依据。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>选择归因模型："位置归因"（首次和末次权重更高）</li>
            <li>转化指标：选择"购买"事件，筛选订单金额 &gt; 100元</li>
            <li>归因事件：选择各营销活动相关的触点事件</li>
            <li>时间范围：活动期间（如：2024-11-01 至 2024-11-11）</li>
            <li>按活动维度分组，查看各活动的归因转化金额</li>
          </ol>
          <p><strong>分析结果：</strong>结合各活动的投入成本，计算出：双11大促活动ROI为1:4.8，品牌广告活动ROI为1:2.3，内容营销活动ROI为1:5.2。虽然内容营销的ROI最高，但品牌广告的绝对转化金额最大。建议采用组合策略：内容营销用于长期品牌建设，品牌广告用于短期销量提升。</p>
        </div>
      </div>
    </Card>
  )
}

export default AttributionGuide
