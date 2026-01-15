export enum Role {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest'
}

/**
 * 角色类型枚举
 */
export enum RoleType {
  /** 系统角色，不可修改和删除 */
  SYSTEM = 'system',
  /** 用户自定义角色，可以修改和删除 */
  CUSTOM = 'custom',
}
