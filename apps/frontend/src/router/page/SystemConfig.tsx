import type { IRouteItem } from "@router/type"
import React, { lazy } from "react"
import { SettingOne } from "@icon-park/react"

export default {
  name: '系统设置',
  key: 'system-config',
  meta: {
    icon: <SettingOne theme="outline" size="16" fill="currentColor" />,
  },
  children: [{
    name: '用户管理',
    key: 'system-config-user',
    path: '/system-config/user',
    component: lazy(() => import('@pages/system-config/user')),
  }, {
    name: '系统管理',
    key: 'system-config-system',
    path: '/system-config/system',
    component: lazy(() => import('@pages/system-config/system')),
  }, {
    name: '计算节点配置',
    key: 'system-config-computing-node',
    path: '/system-config/computing-node',
    component: lazy(() => import('@pages/system-config/computing-node')),
  }, {
    name: '角色管理',
    key: 'system-config-role',
    path: '/system-config/role',
    component: lazy(() => import('@pages/system-config/role')),
  }, {
    name: '权限列表',
    key: 'system-config-permission-list',
    path: '/system-config/permission-list',
    component: lazy(() => import('@pages/system-config/permission-list')),
    meta: {
      isHidden: true, // 隐藏菜单，只能通过角色管理页面跳转
    },
  }, {
  //   name: '权限管理',
  //   key: 'system-config-permission',
  //   path: '/system-config/permission',
  //   component: lazy(() => import('@pages/system-config/permission')),
  // }, {
    name: '系统参数配置',
    key: 'system-config-system-params',
    path: '/system-config/system-params',
    component: lazy(() => import('@pages/system-config/system-params')),
  }, {
    name: '数据源配置',
    key: 'system-config-datasource',
    path: '/system-config/datasource',
    component: lazy(() => import('@pages/system-config/datasource')),
  }, {
    name: '通知设置',
    key: 'system-config-notification',
    path: '/system-config/notification',
    component: lazy(() => import('@pages/system-config/notification')),
  }, {
    name: '日志配置',
    key: 'system-config-log-config',
    path: '/system-config/log-config',
    component: lazy(() => import('@pages/system-config/log-config')),
  }, {
    name: '项目管理',
    key: 'system-config-project',
    path: '/system-config/project',
    component: lazy(() => import('@pages/system-config/project')),
  }, {
    name: '审计日志',
    key: 'system-config-audit-log',
    path: '/system-config/audit-log',
    component: lazy(() => import('@pages/system-config/audit-log')),
  }],
} as IRouteItem
