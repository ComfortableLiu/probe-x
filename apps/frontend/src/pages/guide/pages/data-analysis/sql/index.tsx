import React from "react"
import { Card } from "antd"
import GuideHeader from "../../../components/GuideHeader"
import * as styles from "../../../styles.module.scss"

function SqlGuide() {
  return (
    <Card>
      <GuideHeader title="SQL 查询说明" />
      <div className={styles.guideContent}>
        <h3>什么时候使用</h3>
        <p>使用 ClickHouse SQL 查看事件明细或进行自定义统计。该页面执行只读业务数据查询；常用事件、漏斗和归因分析也可以直接在对应分析页面配置。</p>

        <h3>操作步骤</h3>
        <ol>
          <li>在编辑器中输入一条以 SELECT 或 WITH 开头的查询。</li>
          <li>点击“执行”，或使用 Cmd / Ctrl + Enter 快捷键。</li>
          <li>查看返回行数、耗时、列名和列类型；结果表格可以分页，宽表格可以横向滚动。</li>
          <li>出现“查询失败”时，根据页面错误信息检查表名、列名、语法及查询限制后再执行。</li>
        </ol>

        <h3>查询示例</h3>
        <p>先查看少量最终清洗后的事件，确认字段与数据是否符合预期：</p>
        <pre><code>{'SELECT *\nFROM probe_x.final_event_log\nLIMIT 100'}</code></pre>
        <p>表名或列名包含 $ 等特殊字符时，用反引号包裹。示例不指定排序，返回的 100 行不表示最近 100 条事件。</p>

        <h3>查询范围与限制</h3>
        <ul>
          <li>仅支持单条只读查询，不能通过此页面新增、修改或删除数据。</li>
          <li>未指定顶层 LIMIT 时默认限制返回 1,000 行；普通查询显式指定 LIMIT 时使用该值。服务端执行时间上限为 30 秒。</li>
          <li>仅支持业务数据查询与少数虚拟生成表，不允许访问系统管理数据，以及读取服务器文件、外部数据源或执行命令的函数。</li>
          <li>结果表格的分页只切换本次已返回的数据，不会继续从数据库加载更多记录。</li>
        </ul>

        <div className={styles.scenarioBox}>
          <h4>结果为空或查询耗时较长</h4>
          <p>确认所查日期已完成最终清洗，核对事件名称和筛选字段。查询明细时优先指定日期条件、所需列与适当 LIMIT；聚合查询即使只返回几行，也可能扫描大量原始记录。</p>
        </div>
      </div>
    </Card>
  )
}

export default SqlGuide
