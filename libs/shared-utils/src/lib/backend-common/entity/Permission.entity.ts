import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { RolePermissionRelation } from './RolePermissionRelation.entity'
import { System } from './System.entity'

/**
 * 权限表实体
 * 存储系统中所有细粒度权限（如菜单、按钮、接口权限）
 * 支持系统维度：system_id为NULL表示全局权限，有值表示系统级权限
 */
@Entity('permission', {
  comment: '权限表：存储系统中所有细粒度权限（如菜单、按钮、接口权限）。通过 RolePermissionRelation 与 Role 建立多对多关系。支持系统维度：system_id为NULL表示全局权限，有值表示系统级权限',
})
export class Permission {
  /** 权限唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id?: number

  /** 权限标识（格式：资源:操作，如 user:add），在同一系统内唯一 */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'permission_key',
    comment: '权限标识（格式：资源:操作，如 user:add），在同一系统内唯一（system_id+permission_key联合唯一）',
  })
  @Index()
  permissionKey?: string

  /** 关联的系统ID（NULL表示全局权限，有值表示系统级权限） */
  @Column({
    type: 'bigint',
    name: 'system_id',
    nullable: true,
    comment: '关联的系统ID（NULL表示全局权限，有值表示系统级权限）',
  })
  @Index()
  systemId?: number

  /** 权限显示名（如"新增用户"），用于前端页面展示 */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'permission_name',
    comment: '权限显示名（用于前端页面展示）',
  })
  permissionName?: string

  /** 权限描述（如"允许新增系统用户，仅管理员可用”） */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'description',
    nullable: true,
    comment: '权限描述（说明权限的用途和适用范围）',
  })
  description?: string

  /** 父权限ID（用于构建树形结构，0或null表示顶级权限/页面） */
  @Column({
    type: 'bigint',
    name: 'parent_id',
    nullable: true,
    comment: '父权限ID（用于构建树形结构，0或null表示顶级权限/页面）',
  })
  @Index()
  parentId?: number

  /** 权限层级（用于标识和排序，支持任意层数，1=页面/顶级，2=功能，3=子功能，以此类推） */
  @Column({
    type: 'tinyint',
    name: 'level',
    default: 1,
    comment: '权限层级（用于标识和排序，支持任意层数，1=页面/顶级，2=功能，3=子功能，以此类推）',
  })
  level?: number

  /** 权限是否启用（1=启用，0=禁用），禁用的权限不会分配给角色，默认启用 */
  @Column({
    type: 'boolean',
    name: 'is_enable',
    default: true,
    comment: '权限是否启用（1=启用，0=禁用），禁用的权限不会分配给角色，默认启用',
  })
  isEnable?: number

  /** 权限创建时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '权限创建时间（自动填充）',
  })
  createdAt?: Date

  /** 权限更新时间（自动更新） */
  @UpdateDateColumn({
    type: 'datetime',
    name: 'updated_at',
    comment: '权限更新时间（自动更新）',
  })
  updatedAt?: Date

  /**
   * 父权限实体（多对一：多个权限可以属于同一个父权限）
   */
  @ManyToOne(() => Permission, (permission) => permission.children, {
    onDelete: 'CASCADE', // 父权限删除时，级联删除子权限
    cascade: false,
  })
  @JoinColumn({ name: 'parent_id' }) // 映射数据库字段 parent_id
  parent?: Permission

  /**
   * 子权限列表（一对多：一个权限可以有多个子权限）
   */
  @OneToMany(() => Permission, (permission) => permission.parent)
  children?: Permission[]

  /**
   * 关联的系统实体（多对一：多个权限可以属于同一个系统）
   */
  @ManyToOne(() => System, (system) => system.permissions, {
    onDelete: 'SET NULL', // 系统删除时，设置为NULL（变为全局权限）
    cascade: false,
  })
  @JoinColumn({ name: 'system_id' })
  system?: System

  /**
   * 反向关联：当前权限被哪些角色绑定
   * 通过 RolePermissionRelation 与 Role 建立多对多关系
   */
  @OneToMany(() => RolePermissionRelation, (relation) => relation.permission)
  roleRelations?: RolePermissionRelation[]
}
