/**
 * Test data constants for E2E tests.
 */

export const TEST_USER = {
  username: 'admin',
  password: 'admin123',
  role: 'super_admin',
};

export const ALL_PAGES = [
  // 首页
  { path: '/', name: '首页/数据看板', module: 'homepage' },

  // 埋点管理
  { path: '/point-manage/event', name: '事件管理', module: 'point-manage' },
  { path: '/point-manage/property', name: '属性管理', module: 'point-manage' },
  { path: '/point-manage/spm', name: 'SPM管理', module: 'point-manage' },
  { path: '/point-manage/scm', name: 'SCM管理', module: 'point-manage' },
  { path: '/point-manage/basic-coding', name: '基础编码管理', module: 'point-manage' },

  // 数据分析
  { path: '/data-analysis/event', name: '事件分析', module: 'data-analysis' },
  { path: '/data-analysis/funnel', name: '漏斗分析', module: 'data-analysis' },
  { path: '/data-analysis/free', name: '自由分析', module: 'data-analysis' },
  { path: '/data-analysis/userPath', name: '用户路径分析', module: 'data-analysis' },
  { path: '/data-analysis/attribution', name: '归因分析', module: 'data-analysis' },
  { path: '/data-analysis/dashboardConfig', name: '看板设置', module: 'data-analysis' },

  // 系统数据
  { path: '/system-data/overview', name: '总览', module: 'system-data' },
  { path: '/system-data/analysis', name: '数分数据', module: 'system-data' },
  { path: '/system-data/meta', name: '元数据', module: 'system-data' },
  { path: '/system-data/computingNode', name: '计算节点', module: 'system-data' },

  // 系统设置
  { path: '/system-config/user', name: '用户管理', module: 'system-config' },
  { path: '/system-config/system', name: '系统管理', module: 'system-config' },
  { path: '/system-config/computing-node', name: '计算节点配置', module: 'system-config' },
  { path: '/system-config/role', name: '角色管理', module: 'system-config' },
  { path: '/system-config/system-params', name: '系统参数配置', module: 'system-config' },
  { path: '/system-config/datasource', name: '数据源配置', module: 'system-config' },
  { path: '/system-config/notification', name: '通知设置', module: 'system-config' },
  { path: '/system-config/log-config', name: '日志配置', module: 'system-config' },
  { path: '/system-config/project', name: '项目管理', module: 'system-config' },
  { path: '/system-config/audit-log', name: '审计日志', module: 'system-config' },
  { path: '/system-config/alert', name: '告警管理', module: 'system-config' },

  // 账户
  { path: '/account', name: '个人中心', module: 'account' },

  // 系统说明
  { path: '/guide', name: '系统说明首页', module: 'guide' },
] as const;

export const SIDEBAR_MODULES = [
  { name: '首页', hasChildren: false },
  { name: '埋点管理', hasChildren: true, children: ['事件管理', '属性管理', 'SPM管理', 'SCM管理', '基础编码管理'] },
  { name: '数据分析', hasChildren: true, children: ['事件分析', '漏斗分析', '自由分析', '用户路径分析', '归因分析', '看板设置'] },
  { name: '系统数据', hasChildren: true, children: ['总览', '数分数据', '元数据', '计算节点'] },
  { name: '系统设置', hasChildren: true, children: ['用户管理', '系统管理', '计算节点配置', '角色管理', '系统参数配置', '数据源配置', '通知设置', '日志配置', '项目管理', '审计日志', '告警管理'] },
] as const;
