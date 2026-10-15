import React from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button, Card, Collapse, Space } from "antd"
import { ArrowRightOutlined, BarChartOutlined, DatabaseOutlined, EnvironmentOutlined } from "@ant-design/icons"
import { guideCategories } from "../catalog"
import * as styles from "../styles.module.scss"

const categoryIcons: Record<string, React.ReactNode> = {
  'data-analysis': <BarChartOutlined />,
  'system-data': <DatabaseOutlined />,
  'point-manage': <EnvironmentOutlined />,
}
const quickSteps = [
  { title: '规范埋点位置', path: '/guide/point-manage/spm', description: '先理解 SPM / SCM 编码，再在业务中接入事件采集。' },
  { title: '验证数据与指标', path: '/guide/data-analysis/event', description: '从一个事件和较短日期范围开始，确认次数、人数与筛选条件。' },
  { title: '保存常用分析', path: '/guide/data-analysis/dashboard-config', description: '将分析保存到看板，配置全局或卡片自己的日期范围。' },
]
const pipelineSteps = ['SDK 采集', '接收 / Kafka', '初次清洗入库', '调度会话任务', '并行最终清洗', '分析查询']

function GuideIndex() {
  const navigate = useNavigate()

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>PROBE-X · 使用指南</span>
        <h2>从采集到分析，读懂你的数据</h2>
        <p>查找功能的操作步骤，理解数据统计口径，排查采集与清洗过程中的常见问题。</p>
        <Space wrap size={12}>
          <Button type="primary" onClick={() => navigate('/guide/data-analysis/event')}>开始事件分析 <ArrowRightOutlined /></Button>
          <Button onClick={() => navigate('/guide/system-data/overview')}>检查系统运行状态</Button>
        </Space>
      </section>

      <section aria-label="快速上手">
        <h3>快速上手</h3>
        <div className={styles.quickStart}>
          {quickSteps.map((step, index) => (
            <div className={styles.quickStep} key={step.path}>
              <span>{index + 1}</span>
              <div><Link to={step.path}>{step.title}</Link><p>{step.description}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="功能目录">
        <h3>功能目录</h3>
        <div className={styles.categoryGrid}>
          {guideCategories.map(category => (
            <Card title={<>{categoryIcons[category.key]}{category.label}</>} key={category.key} className={styles.categoryCard}>
              <p>{category.description}</p>
              <div className={styles.entryList}>
                {category.items.map(entry => (
                  <Link className={styles.entryLink} to={entry.path} key={entry.key}>
                    <span>{entry.label}<small>{entry.summary}</small></span><ArrowRightOutlined />
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <Card title="数据如何进入分析结果">
        <p>采集与最终清洗分阶段执行。初次清洗完成后数据进入中间事件表，调度服务再按日期和会话分配任务，由计算节点并行处理并写入最终事件表。</p>
        <div className={styles.pipeline} aria-label={pipelineSteps.join(' → ')}>
          {pipelineSteps.map((step, index) => (
            <React.Fragment key={step}>
              {index > 0 && <ArrowRightOutlined />}
              <span>{step}</span>
            </React.Fragment>
          ))}
        </div>
        <p>最终清洗支持手动调度和按配置自动调度，只处理今天之前的日期。分析结果是否可用，需要结合最终清洗进度和所选事件日期判断。<Link to="/guide/system-data/computing-node">查看清洗与并发说明 <ArrowRightOutlined /></Link></p>
      </Card>

      <section aria-label="常见问题">
        <h3>常见问题</h3>
        <Collapse
          className={styles.faq}
          items={[
            {
              key: 'empty',
              label: '已经有采集数据，为什么分析结果还是空的？',
              children: <p>先检查分析日期、事件名称和筛选条件，再到元数据页确认最终清洗数据是否产生；初次清洗入库不代表最终清洗已完成。<Link to="/guide/system-data/meta">查看元数据说明</Link>。</p>,
            },
            {
              key: 'rate',
              label: '成功率或速度显示横线，代表失败或速度为 0 吗？',
              children: <p>横线表示当前没有可用样本或不适用。成功率按清洗执行日期统计，初次清洗按事件次数、最终清洗按会话任务次数计数；节点实时速度只在有效计算期间显示。真实的 0 会显示为 0。<Link to="/guide/system-data/meta">成功率口径</Link> / <Link to="/guide/system-data/computing-node">速度口径</Link>。</p>,
            },
            {
              key: 'time',
              label: '看板卡片和“查看详情”使用哪个日期？',
              children: <p>卡片使用自己的日期设置；选择跟随全局时，使用看板顶部的日期。“查看详情”携带卡片当前生效的日期和分析条件。对比结果时，请先确认各卡片日期一致。<Link to="/guide/data-analysis/dashboard-config">查看看板说明</Link>。</p>,
            },
            {
              key: 'dictionary',
              label: '新增 SPM / SCM 编码后，为什么没有分析数据？',
              children: <p>管理页面维护的是编码字典。新增编码后，还需要业务端实际发送带有对应编码的事件，并完成清洗，才会产生可分析的数据。<Link to="/guide/point-manage/spm">查看 SPM 说明</Link> / <Link to="/guide/point-manage/scm">查看 SCM 说明</Link>。</p>,
            },
          ]}
        />
      </section>
    </div>
  )
}

export default GuideIndex
