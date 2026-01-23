import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function UserPathGuide() {
  return (
    <Card>
      <GuideHeader title="用户路径分析说明" />
      <div className={styles.guideContent}>
        <h3>页面介绍</h3>
        <p>用户路径分析页面用于分析用户在应用中的行为路径，了解用户从进入应用到完成目标行为的完整路径。</p>

        <h3>核心功能</h3>
        <ul>
          <li><strong>路径可视化</strong>：以图表形式展示用户的典型行为路径，支持查看路径的转化率和流失点</li>
          <li><strong>路径筛选</strong>：支持设置起始事件和结束事件，可筛选特定用户群体的路径</li>
          <li><strong>路径深度设置</strong>：可配置分析的路径深度（如3步、5步、10步等），支持查看不同深度的路径分析</li>
          <li><strong>全局筛选</strong>：支持对用户属性、事件属性进行筛选，可分析特定用户群体的行为路径</li>
          <li><strong>时间范围选择</strong>：支持自定义时间范围查询，默认显示最近7天的数据</li>
          <li><strong>数据导出</strong>：支持将路径分析结果导出为文件</li>
        </ul>

        <h3>使用场景</h3>
        <ul>
          <li><strong>用户行为洞察</strong>：了解用户在使用产品时的典型行为路径</li>
          <li><strong>产品优化</strong>：发现用户路径中的异常跳转或流失点，优化产品流程</li>
          <li><strong>新用户引导</strong>：分析新用户的典型路径，优化新用户引导流程</li>
          <li><strong>功能关联分析</strong>：发现功能之间的关联关系，优化功能布局</li>
          <li><strong>异常路径识别</strong>：识别异常的用户行为路径，发现潜在问题</li>
        </ul>

        <h3>典型应用示例</h3>
        <ul>
          <li>分析用户从"首页"到"完成购买"的典型路径</li>
          <li>对比新用户和老用户的行为路径差异</li>
          <li>发现用户在注册流程中的异常跳转行为</li>
          <li>分析用户在使用搜索功能后的后续行为路径</li>
        </ul>

        <h3>实际场景示例</h3>
        <div className={styles.scenarioBox}>
          <h4>场景一：电商购买路径分析</h4>
          <p><strong>业务背景：</strong>电商平台需要了解用户从进入首页到完成购买的典型路径，优化购物流程。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>设置起始事件："首页访问"</li>
            <li>设置结束事件："支付成功"</li>
            <li>路径深度设置为5步</li>
            <li>时间范围：最近7天</li>
            <li>全局筛选：订单金额 &gt; 100元</li>
          </ol>
          <p><strong>分析结果：</strong>发现最常见的购买路径是：首页 {'→'} 分类页 {'→'} 商品详情页 {'→'} 购物车 {'→'} 支付成功（占比32%）。其次是：首页 {'→'} 搜索 {'→'} 商品详情页 {'→'} 直接购买 {'→'} 支付成功（占比28%）。建议在首页增加热门分类入口，提升分类页的访问量。</p>
        </div>

        <div className={styles.scenarioBox}>
          <h4>场景二：新用户引导路径优化</h4>
          <p><strong>业务背景：</strong>产品团队需要分析新用户首次使用产品的行为路径，优化新用户引导流程。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>设置起始事件："首次启动App"</li>
            <li>设置结束事件："完成核心功能使用"（如：发布第一条内容）</li>
            <li>路径深度设置为10步</li>
            <li>全局筛选：用户类型 = "新用户" 且 注册时间 = "最近7天"</li>
            <li>时间范围：最近7天</li>
          </ol>
          <p><strong>分析结果：</strong>发现45%的新用户路径中包含"跳过引导"步骤，且这些用户的完成率（18%）明显低于完成引导的用户（35%）。建议优化引导流程，增加引导的趣味性和必要性，减少跳过率。</p>
        </div>

        <div className={styles.scenarioBox}>
          <h4>场景三：内容消费路径分析</h4>
          <p><strong>业务背景：</strong>视频平台需要分析用户的内容消费路径，了解用户如何发现和观看内容。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>设置起始事件："进入首页"</li>
            <li>设置结束事件："观看视频超过5分钟"</li>
            <li>路径深度设置为8步</li>
            <li>按内容类型维度分组，对比不同类型内容的消费路径</li>
            <li>时间范围：最近30天</li>
          </ol>
          <p><strong>分析结果：</strong>发现用户主要通过"推荐流"（42%）和"搜索"（28%）发现内容，而"分类浏览"仅占15%。建议优化推荐算法，同时增加分类页的入口曝光，提升分类浏览的使用率。</p>
        </div>

        <div className={styles.scenarioBox}>
          <h4>场景四：异常路径识别</h4>
          <p><strong>业务背景：</strong>系统监控发现部分用户在注册流程中出现异常跳转，需要识别异常路径并修复问题。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>设置起始事件："进入注册页"</li>
            <li>设置结束事件："注册成功"或"离开注册流程"</li>
            <li>路径深度设置为6步</li>
            <li>全局筛选：注册失败 = true</li>
            <li>时间范围：最近3天</li>
          </ol>
          <p><strong>分析结果：</strong>发现15%的失败用户路径中包含"验证码输入 {'→'} 返回上一步 {'→'} 再次输入验证码"的循环，说明验证码输入体验存在问题。另外发现8%的用户在"设置密码"步骤后直接跳转到"首页"而非"注册成功"页，可能是系统bug。立即修复了验证码输入逻辑和注册成功跳转逻辑。</p>
        </div>
      </div>
    </Card>
  )
}

export default UserPathGuide
