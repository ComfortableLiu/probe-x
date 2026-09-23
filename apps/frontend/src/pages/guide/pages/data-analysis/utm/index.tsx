import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function UtmGuide() {
  return (
    <Card>
      <GuideHeader title="UTM 分析说明" />
      <div className={styles.guideContent}>
        <h3>页面介绍</h3>
        <p>
          UTM 分析页面用于分析各投放链接带来的流量效果。埋点上报里带的 UTM 参数（来源、媒介、活动、关键词、内容）
          会在这里按维度组合交叉分析，输出各组合的事件数、用户数、会话数，用来回答「这次投放带来了多少人、哪个渠道最有效」。
        </p>

        <h3>核心功能</h3>
        <ul>
          <li><strong>UTM 分组维度</strong>：从来源（utm_source）、媒介（utm_medium）、活动（utm_campaign）、关键词（utm_term）、内容（utm_content）里任选 1~5 个维度，按组合交叉分析。只选来源就是看各来源的量，来源+媒介一起选则是看具体投放位的效果</li>
          <li><strong>数据指标</strong>：事件数、用户数、会话数可多选。第一个选中的指标决定表格排序与趋势图的纵轴</li>
          <li><strong>UTM 取值筛选</strong>：可以只看某几个具体取值。取值来自「埋点管理 &gt; UTM 管理」里维护的条目，下拉里带别名展示</li>
          <li><strong>全局筛选</strong>：支持对用户属性、事件属性等进行筛选，可精确分析特定人群的投放效果</li>
          <li><strong>时间范围选择</strong>：支持自定义时间范围查询，默认显示最近 7 天的数据</li>
          <li><strong>趋势图</strong>：按天的指标趋势，展示合计与取值量最大的前 10 个分组</li>
          <li><strong>汇总表</strong>：每个 UTM 取值组合一行，给出各指标在所选时间区间内的合计</li>
          <li><strong>数据导出</strong>：支持将分析结果导出为 Excel，走异步导出任务</li>
          <li><strong>保存为看板</strong>：可把当前分析配置存成看板卡片，放到首页统一查看</li>
        </ul>

        <h3>与 UTM 管理的关系</h3>
        <ul>
          <li><strong>别名</strong>：在 UTM 管理里给取值填了别名后，本页表格的维度列 hover 可见别名，取值筛选器下拉里显示「别名（原始取值）」</li>
          <li><strong>软删除</strong>：在 UTM 管理里删掉某个取值后，它在本页的任何维度上都不再计入 —— 不只不作为分组行出现，它贡献的事件也不会算进其它维度的组合里。误删可在「已删除」页签里恢复</li>
          <li><strong>口径差异</strong>：UTM 管理页的「累计事件数」来自清洗前的事件表，本页查的是清洗后的事件表，两者数值不必相等</li>
        </ul>

        <h3>使用场景</h3>
        <ul>
          <li><strong>投放效果评估</strong>：对比不同来源、不同活动带来的用户数与会话数</li>
          <li><strong>渠道预算分配</strong>：找出性价比最高的来源/媒介组合，指导下一轮预算分配</li>
          <li><strong>活动复盘</strong>：按活动维度看某次营销活动整个周期的流量走势</li>
          <li><strong>关键词优化</strong>：按关键词维度看搜索投放里哪些词真正带来了量</li>
          <li><strong>素材对比</strong>：按内容维度对比同一批投放里不同素材的引流效果</li>
        </ul>

        <h3>典型应用示例</h3>
        <ul>
          <li>只按「来源」分组，看最近 30 天各来源的用户数排名</li>
          <li>按「来源 + 媒介」交叉，找出 google / cpc 这类具体投放位的效果差异</li>
          <li>用 UTM 取值筛选锁定某个活动，再按「内容」分组，对比该活动下不同素材的引流</li>
          <li>删掉内部测试用的 utm 取值，让报表不再被测试流量污染</li>
        </ul>

        <h3>实际场景示例</h3>
        <div className={styles.scenarioBox}>
          <h4>场景一：双十一投放渠道复盘</h4>
          <p><strong>业务背景：</strong>某电商在双十一期间在多个渠道投了广告，需要在活动结束后评估各渠道的真实引流效果，为下一年的预算分配提供依据。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>UTM 分组维度选择「来源（utm_source）+ 媒介（utm_medium）」</li>
            <li>数据指标全选：事件数、用户数、会话数</li>
            <li>UTM 取值筛选：活动（utm_campaign）= double11-2025</li>
            <li>时间范围：2025-11-01 至 2025-11-11</li>
          </ol>
          <p><strong>分析结果：</strong>发现 google / cpc 组合带来的用户数最高但会话数偏低，说明拉新多但深度不够；而某垂直媒体 / newsletter 组合用户数不高，人均会话数却是最高的。下一年把品牌预算向后者倾斜。</p>
        </div>

        <div className={styles.scenarioBox}>
          <h4>场景二：清理测试流量</h4>
          <p><strong>业务背景：</strong>投放同学自测链接时给 UTM 打了 internal-test 之类的取值，这些流量混在报表里把真实数据抬高了。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>进入「埋点管理 &gt; UTM 管理」，搜索取值 internal-test</li>
            <li>点「删除」把它软删除</li>
            <li>回到 UTM 分析重新查询</li>
          </ol>
          <p><strong>分析结果：</strong>该取值不再出现在任何分组里，它贡献的事件也不会再算进其它维度组合。若发现误删，在「已删除 UTM」页签里点「恢复」即可。</p>
        </div>

        <div className={styles.scenarioBox}>
          <h4>场景三：搜索投放关键词优化</h4>
          <p><strong>业务背景：</strong>搜索广告投了上百个关键词，需要找出真正带来流量的词，把预算从无效词上挪走。</p>
          <p><strong>操作步骤：</strong></p>
          <ol>
            <li>UTM 分组维度选择「关键词（utm_term）」</li>
            <li>数据指标选「用户数」</li>
            <li>UTM 取值筛选：来源（utm_source）= google，媒介（utm_medium）= cpc</li>
            <li>时间范围：最近 30 天</li>
          </ol>
          <p><strong>分析结果：</strong>趋势图与汇总表都显示头部 20 个词贡献了绝大部分用户数，长尾词几乎没有量。把长尾词的预算收拢到头部词上后，同样的花费用户数提升了约三成。</p>
        </div>
      </div>
    </Card>
  )
}

export default UtmGuide
