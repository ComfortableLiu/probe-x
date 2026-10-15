export interface GuideEntry {
  key: string
  label: string
  path: string
  appPath: string
  summary: string
}

export interface GuideCategory {
  key: string
  label: string
  description: string
  items: GuideEntry[]
}

export const guideCategories: GuideCategory[] = [
  {
    key: 'data-analysis',
    label: '数据分析',
    description: '从事件、转化和来源理解用户行为，把常用分析保存到看板。',
    items: [
      { key: 'event', label: '事件分析', path: '/guide/data-analysis/event', appPath: '/data-analysis/event', summary: '选择事件、指标与维度，比较次数和用户数。' },
      { key: 'funnel', label: '漏斗分析', path: '/guide/data-analysis/funnel', appPath: '/data-analysis/funnel', summary: '按业务步骤查看转化和流失。' },
      { key: 'user-path', label: '用户路径分析', path: '/guide/data-analysis/user-path', appPath: '/data-analysis/userPath', summary: '从起点或终点观察事件流转。' },
      { key: 'attribution', label: '归因分析', path: '/guide/data-analysis/attribution', appPath: '/data-analysis/attribution', summary: '比较不同归因模型下的触点贡献。' },
      { key: 'utm', label: 'UTM 分析', path: '/guide/data-analysis/utm', appPath: '/data-analysis/utm', summary: '按来源、媒介和活动分析渠道表现。' },
      { key: 'sql', label: 'SQL 查询', path: '/guide/data-analysis/sql', appPath: '/data-analysis/sql', summary: '使用只读查询检查数据与自定义统计。' },
      { key: 'dashboard-config', label: '看板设置', path: '/guide/data-analysis/dashboard-config', appPath: '/data-analysis/dashboardConfig', summary: '管理分析卡片、布局和生效日期。' },
    ],
  },
  {
    key: 'system-data',
    label: '系统数据',
    description: '检查采集和清洗链路，理解成功率、节点状态与吞吐速度。',
    items: [
      { key: 'overview', label: '系统数据总览', path: '/guide/system-data/overview', appPath: '/system-data/overview', summary: '查看运行状态、资源与链路指标。' },
      { key: 'analysis', label: '数分数据', path: '/guide/system-data/analysis', appPath: '/system-data/analysis', summary: '查看分析查询、导出和任务统计。' },
      { key: 'meta', label: '元数据', path: '/guide/system-data/meta', appPath: '/system-data/meta', summary: '区分数据存量与清洗成功率的统计口径。' },
      { key: 'computing-node', label: '计算节点', path: '/guide/system-data/computing-node', appPath: '/system-data/computingNode', summary: '检查并发容量、清洗进度与节点总速度。' },
    ],
  },
  {
    key: 'point-manage',
    label: '埋点管理',
    description: '维护页面位置和内容来源编码，让埋点位置可识别、可追踪。',
    items: [
      { key: 'spm', label: 'SPM 管理', path: '/guide/point-manage/spm', appPath: '/point-manage/spm', summary: '按项目、页面、模块和点位管理位置。' },
      { key: 'scm', label: 'SCM 管理', path: '/guide/point-manage/scm', appPath: '/point-manage/scm', summary: '逐级管理内容来源编码与组合。' },
    ],
  },
]

export const guideEntries = guideCategories.flatMap(category => category.items)

// 路由会自动生成 .html 别名；目录和面包屑共用规范路径。
export function normalizeGuidePath(pathname: string) {
  return pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/'
}

export function getGuideContext(pathname: string) {
  const path = normalizeGuidePath(pathname)
  const category = guideCategories.find(item => item.items.some(entry => entry.path === path))
  const entry = category?.items.find(item => item.path === path)
  return { category, entry }
}

export function getLegacyGuidePath(pageKey?: string) {
  const aliases: Record<string, string> = {
    'system-overview': 'overview',
    'system-analysis': 'analysis',
  }
  const key = pageKey ? aliases[pageKey] || pageKey : undefined
  return guideEntries.find(entry => entry.key === key)?.path
}
