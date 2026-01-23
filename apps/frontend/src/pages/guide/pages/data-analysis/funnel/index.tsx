import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function FunnelGuide() {
  return (
    <Card>
      <GuideHeader title="漏斗分析说明" />
      <div className={styles.guideContent}>
        <h3>页面介绍</h3>
        <p>漏斗分析页面用于分析用户在业务流程中的转化情况，通过可视化漏斗图展示用户在各个环节的流失和转化数据。</p>

        <h3>核心功能</h3>
        <ul>
          <li><strong>漏斗类型选择</strong>：支持用户级漏斗分析（以用户为单位）和会话级漏斗分析（以会话为单位）</li>
          <li><strong>窗口期设置</strong>：可配置转化窗口期（如7天、14天、30天等），用于定义用户完成整个漏斗转化的时间范围</li>
          <li><strong>漏斗配置</strong>：支持多步骤漏斗配置，每个步骤可配置具体的事件和筛选条件</li>
          <li><strong>数据维度分析</strong>：支持按不同维度（如渠道、设备、地区等）进行分组分析</li>
          <li><strong>全局筛选</strong>：支持对用户属性、事件属性等进行筛选，可精确分析特定用户群体的转化情况</li>
          <li><strong>时间范围选择</strong>：支持自定义时间范围查询，默认显示最近7天的数据</li>
          <li><strong>数据导出</strong>：支持将分析结果导出为文件，支持异步导出任务</li>
        </ul>

        <h3>使用场景</h3>
        <ul>
          <li><strong>电商转化分析</strong>：分析从浏览商品 {'→'} 加入购物车 {'→'} 下单 {'→'} 支付的转化率</li>
          <li><strong>注册流程优化</strong>：分析注册流程各步骤的流失情况，找出优化点</li>
          <li><strong>营销活动效果评估</strong>：分析营销活动带来的用户转化效果</li>
          <li><strong>产品功能使用分析</strong>：分析用户使用产品功能的完整流程转化情况</li>
          <li><strong>渠道效果对比</strong>：对比不同渠道（如App、Web、小程序）的转化率差异</li>
        </ul>

        <h3>典型应用示例</h3>
        <ul>
          <li>分析"首页访问 {'→'} 商品详情页 {'→'} 加入购物车 {'→'} 结算 {'→'} 支付成功"的完整转化漏斗</li>
          <li>对比不同设备类型（iOS、Android）的注册转化率</li>
          <li>分析新用户与老用户在购买流程中的转化差异</li>
        </ul>

        <h3>实际场景示例</h3>
        <div className={styles.scenarioBox}>
          <h4>场景一：电商平台双11活动转化分析</h4>
          <p><strong>业务背景：</strong>某电商平台在双11活动期间，需要分析从活动页面浏览到最终支付的完整转化情况。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>选择"用户级漏斗"，窗口期设置为7天</li>
            <li>配置漏斗步骤：活动页浏览 {'→'} 商品详情页 {'→'} 加入购物车 {'→'} 提交订单 {'→'} 支付成功</li>
            <li>时间范围选择：2024-11-01 至 2024-11-11</li>
            <li>按渠道维度分组，对比App、Web、小程序三个渠道的转化率</li>
          </ol>
          <p><strong>分析结果：</strong>发现App渠道的支付转化率（15.2%）明显高于Web（8.5%）和小程序（10.3%），建议在App端增加更多营销资源投入。</p>
        </div>

        <div className={styles.scenarioBox}>
          <h4>场景二：新用户注册流程优化</h4>
          <p><strong>业务背景：</strong>产品团队发现新用户注册率下降，需要找出注册流程中的流失环节。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>选择"会话级漏斗"，窗口期设置为1天</li>
            <li>配置漏斗步骤：进入注册页 {'→'} 填写手机号 {'→'} 验证码验证 {'→'} 设置密码 {'→'} 注册成功</li>
            <li>全局筛选：用户类型 = "新用户"</li>
            <li>按设备类型维度分组，对比iOS和Android的转化差异</li>
          </ol>
          <p><strong>分析结果：</strong>发现"验证码验证"环节流失率高达35%，且Android端流失率（42%）明显高于iOS（28%），建议优化Android端的验证码输入体验。</p>
        </div>

        <div className={styles.scenarioBox}>
          <h4>场景三：付费会员转化分析</h4>
          <p><strong>业务背景：</strong>视频平台需要分析免费用户到付费会员的转化情况，评估会员营销活动的效果。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>选择"用户级漏斗"，窗口期设置为30天</li>
            <li>配置漏斗步骤：观看视频 {'→'} 点击会员入口 {'→'} 查看会员权益 {'→'} 选择套餐 {'→'} 支付成功</li>
            <li>时间范围选择：最近30天</li>
            <li>全局筛选：用户属性 - 注册时长 &gt; 7天（排除新用户）</li>
            <li>按营销活动维度分组，对比不同活动带来的转化效果</li>
          </ol>
          <p><strong>分析结果：</strong>发现"限时折扣活动"的转化率（12.5%）是常规活动的2.3倍，建议增加限时活动的频次和力度。</p>
        </div>
      </div>
    </Card>
  )
}

export default FunnelGuide
