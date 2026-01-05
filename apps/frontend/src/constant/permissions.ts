/**
 * 权限枚举配置
 * 用于定义系统中所有页面和功能的权限标识
 */

/**
 * 页面权限枚举
 */
export enum PagePermission {
  // 系统配置
  SYSTEM_CONFIG_USER = 'system:config:user', // 用户管理页面
  SYSTEM_CONFIG_ROLE = 'system:config:role', // 角色管理页面
  SYSTEM_CONFIG_PERMISSION = 'system:config:permission', // 权限管理页面
  SYSTEM_CONFIG_DATASOURCE = 'system:config:datasource', // 数据源配置页面
  SYSTEM_CONFIG_SYSTEM_PARAMS = 'system:config:system-params', // 系统参数配置页面
  SYSTEM_CONFIG_NOTIFICATION = 'system:config:notification', // 通知设置页面
  SYSTEM_CONFIG_LOG_CONFIG = 'system:config:log-config', // 日志配置页面
  SYSTEM_CONFIG_COMPUTING_NODE = 'system:config:computing-node', // 计算节点配置页面

  // 埋点管理
  POINT_MANAGE_EVENT = 'point:manage:event', // 事件管理页面
  POINT_MANAGE_PROPERTY = 'point:manage:property', // 属性管理页面
  POINT_MANAGE_SPM = 'point:manage:spm', // SPM管理页面
  POINT_MANAGE_BASIC_CODING = 'point:manage:basic-coding', // 基础编码管理页面

  // 数据分析
  DATA_ANALYSIS_EVENT = 'data:analysis:event', // 事件分析页面
  DATA_ANALYSIS_FUNNEL = 'data:analysis:funnel', // 漏斗分析页面
  DATA_ANALYSIS_USER_PATH = 'data:analysis:user-path', // 用户路径分析页面
  DATA_ANALYSIS_ATTRIBUTION = 'data:analysis:attribution', // 归因分析页面

  // 系统数据
  SYSTEM_DATA_OVERVIEW = 'system:data:overview', // 系统数据概览页面
  SYSTEM_DATA_META = 'system:data:meta', // 元数据页面
  SYSTEM_DATA_ANALYSIS = 'system:data:analysis', // 系统数据分析页面
}

/**
 * 功能权限枚举
 */
export enum FunctionPermission {
  // 用户管理功能
  USER_CREATE = 'user:create', // 创建用户
  USER_UPDATE = 'user:update', // 更新用户
  USER_DELETE = 'user:delete', // 删除用户
  USER_RESET_PASSWORD = 'user:reset-password', // 重置密码
  USER_ASSIGN_ROLES = 'user:assign-roles', // 分配角色
  USER_VIEW = 'user:view', // 查看用户

  // 角色管理功能
  ROLE_CREATE = 'role:create', // 创建角色
  ROLE_UPDATE = 'role:update', // 更新角色
  ROLE_DELETE = 'role:delete', // 删除角色
  ROLE_ASSIGN_PERMISSIONS = 'role:assign-permissions', // 分配权限
  ROLE_VIEW = 'role:view', // 查看角色

  // 权限管理功能
  PERMISSION_CREATE = 'permission:create', // 创建权限
  PERMISSION_UPDATE = 'permission:update', // 更新权限
  PERMISSION_DELETE = 'permission:delete', // 删除权限
  PERMISSION_VIEW = 'permission:view', // 查看权限

  // 数据源配置功能
  DATASOURCE_CREATE = 'datasource:create', // 创建数据源
  DATASOURCE_UPDATE = 'datasource:update', // 更新数据源
  DATASOURCE_DELETE = 'datasource:delete', // 删除数据源
  DATASOURCE_TEST = 'datasource:test', // 测试数据源连接
  DATASOURCE_VIEW = 'datasource:view', // 查看数据源

  // 系统参数配置功能
  SYSTEM_PARAMS_CREATE = 'system:params:create', // 创建系统参数
  SYSTEM_PARAMS_UPDATE = 'system:params:update', // 更新系统参数
  SYSTEM_PARAMS_DELETE = 'system:params:delete', // 删除系统参数
  SYSTEM_PARAMS_VIEW = 'system:params:view', // 查看系统参数

  // 通知设置功能
  NOTIFICATION_CREATE = 'notification:create', // 创建通知配置
  NOTIFICATION_UPDATE = 'notification:update', // 更新通知配置
  NOTIFICATION_DELETE = 'notification:delete', // 删除通知配置
  NOTIFICATION_VIEW = 'notification:view', // 查看通知配置

  // 日志配置功能
  LOG_CONFIG_CREATE = 'log:config:create', // 创建日志配置
  LOG_CONFIG_UPDATE = 'log:config:update', // 更新日志配置
  LOG_CONFIG_DELETE = 'log:config:delete', // 删除日志配置
  LOG_CONFIG_VIEW = 'log:config:view', // 查看日志配置

  // 计算节点配置功能
  COMPUTING_NODE_CREATE = 'computing:node:create', // 创建计算节点
  COMPUTING_NODE_UPDATE = 'computing:node:update', // 更新计算节点
  COMPUTING_NODE_DELETE = 'computing:node:delete', // 删除计算节点
  COMPUTING_NODE_VIEW = 'computing:node:view', // 查看计算节点

  // 事件管理功能
  EVENT_CREATE = 'event:create', // 创建事件
  EVENT_UPDATE = 'event:update', // 更新事件
  EVENT_DELETE = 'event:delete', // 删除事件
  EVENT_VIEW = 'event:view', // 查看事件

  // 属性管理功能
  PROPERTY_CREATE = 'property:create', // 创建属性
  PROPERTY_UPDATE = 'property:update', // 更新属性
  PROPERTY_DELETE = 'property:delete', // 删除属性
  PROPERTY_VIEW = 'property:view', // 查看属性

  // 数据分析功能
  DATA_ANALYSIS_EXPORT = 'data:analysis:export', // 导出分析数据
  DATA_ANALYSIS_VIEW = 'data:analysis:view', // 查看分析数据
}

/**
 * 系统角色枚举
 */
export enum SystemRoleKey {
  SUPER_ADMIN = 'super_admin', // 超管
  ADMIN = 'admin', // 管理员
  DEVELOPER = 'developer', // 研发
  DATA_ANALYST = 'data_analyst', // 数据分析师
}

/**
 * 系统角色配置
 */
export interface ISystemRoleConfig {
  roleKey: SystemRoleKey
  roleName: string
  description: string
  isSystemRole: true // 标识为系统角色
  isEditable: boolean // 是否可编辑
  isDeletable: boolean // 是否可删除
  pagePermissions: PagePermission[] // 页面权限
  functionPermissions: FunctionPermission[] // 功能权限
}

/**
 * 系统角色权限配置
 */
export const SYSTEM_ROLE_CONFIGS: Record<SystemRoleKey, ISystemRoleConfig> = {
  [SystemRoleKey.SUPER_ADMIN]: {
    roleKey: SystemRoleKey.SUPER_ADMIN,
    roleName: '超管',
    description: '系统超级管理员，拥有所有权限，唯一账号为admin，无法进行任何新增或删除操作',
    isSystemRole: true,
    isEditable: false,
    isDeletable: false,
    pagePermissions: Object.values(PagePermission), // 所有页面权限
    functionPermissions: Object.values(FunctionPermission), // 所有功能权限
  },
  [SystemRoleKey.ADMIN]: {
    roleKey: SystemRoleKey.ADMIN,
    roleName: '管理员',
    description: '系统管理员，拥有除了管理超管角色以外的所有权限',
    isSystemRole: true,
    isEditable: false,
    isDeletable: false,
    pagePermissions: Object.values(PagePermission),
    functionPermissions: Object.values(FunctionPermission).filter(
      // 排除管理超管的权限
      (perm) => perm !== FunctionPermission.USER_ASSIGN_ROLES // 这里可以根据实际需求调整
    ),
  },
  [SystemRoleKey.DEVELOPER]: {
    roleKey: SystemRoleKey.DEVELOPER,
    roleName: '研发',
    description: '研发人员角色，拥有开发和配置相关权限',
    isSystemRole: true,
    isEditable: false,
    isDeletable: false,
    pagePermissions: [
      PagePermission.POINT_MANAGE_EVENT,
      PagePermission.POINT_MANAGE_PROPERTY,
      PagePermission.POINT_MANAGE_SPM,
      PagePermission.POINT_MANAGE_BASIC_CODING,
      PagePermission.SYSTEM_DATA_OVERVIEW,
      PagePermission.SYSTEM_DATA_META,
      PagePermission.SYSTEM_DATA_ANALYSIS,
    ],
    functionPermissions: [
      FunctionPermission.EVENT_CREATE,
      FunctionPermission.EVENT_UPDATE,
      FunctionPermission.EVENT_DELETE,
      FunctionPermission.EVENT_VIEW,
      FunctionPermission.PROPERTY_CREATE,
      FunctionPermission.PROPERTY_UPDATE,
      FunctionPermission.PROPERTY_DELETE,
      FunctionPermission.PROPERTY_VIEW,
      FunctionPermission.DATA_ANALYSIS_VIEW,
    ],
  },
  [SystemRoleKey.DATA_ANALYST]: {
    roleKey: SystemRoleKey.DATA_ANALYST,
    roleName: '数据分析师',
    description: '数据分析师角色，拥有数据分析和查看相关权限',
    isSystemRole: true,
    isEditable: false,
    isDeletable: false,
    pagePermissions: [
      PagePermission.DATA_ANALYSIS_EVENT,
      PagePermission.DATA_ANALYSIS_FUNNEL,
      PagePermission.DATA_ANALYSIS_USER_PATH,
      PagePermission.DATA_ANALYSIS_ATTRIBUTION,
      PagePermission.SYSTEM_DATA_OVERVIEW,
      PagePermission.SYSTEM_DATA_META,
      PagePermission.SYSTEM_DATA_ANALYSIS,
    ],
    functionPermissions: [
      FunctionPermission.DATA_ANALYSIS_EXPORT,
      FunctionPermission.DATA_ANALYSIS_VIEW,
      FunctionPermission.EVENT_VIEW,
      FunctionPermission.PROPERTY_VIEW,
    ],
  },
}

