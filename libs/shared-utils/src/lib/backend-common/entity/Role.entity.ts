import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { RolePermissionRelation } from './RolePermissionRelation.entity'
import { UserRoleRelation } from "./UserRoleRelation.entity"
import { RoleType } from '@probe-x/shared-types/src'
import { System } from './System.entity'

/**
 * 角色表实体
 * 存储系统中的角色信息，包括系统角色和用户自定义角色
 * 系统角色（roleType=SYSTEM）：由系统预定义，不可修改和删除
 * 自定义角色（roleType=CUSTOM）：用户创建，可以修改和删除
 * 支持系统维度：system_id为NULL表示全局角色，有值表示系统级角色
 */
@Entity('role', {
  comment: '角色表：存储系统中的角色信息，包括系统角色和用户自定义角色。系统角色（roleType=SYSTEM）由系统预定义，不可修改和删除；自定义角色（roleType=CUSTOM）由用户创建，可以修改和删除。支持系统维度：system_id为NULL表示全局角色，有值表示系统级角色',
})
export class Role {
  /** 角色唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id?: number

  /** 角色标识（唯一，如 "admin"、"user"），用于权限判断，只能包含小写字母、数字和下划线 */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'role_key',
    comment: '角色标识（唯一，用于权限判断，只能包含小写字母、数字和下划线）',
  })
  @Index()
  roleKey?: string

  /** 角色显示名称（在同一系统内唯一，如 "管理员"、"普通用户"），用于前端页面展示 */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'role_name',
    comment: '角色显示名称（在同一系统内唯一，用于前端页面展示，system_id+role_name联合唯一）',
  })
  @Index()
  roleName?: string

  /** 关联的系统ID（NULL表示全局角色，有值表示系统级角色） */
  @Column({
    type: 'bigint',
    name: 'system_id',
    nullable: true,
    comment: '关联的系统ID（NULL表示全局角色，有值表示系统级角色）',
  })
  @Index()
  systemId?: number

  /** 角色描述（可选，说明角色的用途和权限范围） */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'description',
    nullable: true,
    comment: '角色描述（可选，说明角色的用途和权限范围）',
  })
  description?: string

  /** 角色类型：SYSTEM-系统角色（不可修改和删除），CUSTOM-自定义角色（可修改和删除） */
  @Column({
    type: 'enum',
    enum: RoleType,
    name: 'role_type',
    default: RoleType.CUSTOM,
    comment: '角色类型：SYSTEM-系统角色（不可修改和删除），CUSTOM-自定义角色（可修改和删除）',
  })
  roleType?: RoleType

  /** 是否启用（1=启用，0=禁用），系统角色不可禁用 */
  @Column({
    type: 'boolean',
    name: 'is_enable',
    default: true,
    comment: '是否启用（1=启用，0=禁用），系统角色不可禁用',
  })
  isEnable?: number

  /** 角色创建时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '角色创建时间（自动填充）',
  })
  createdAt?: Date

  /** 角色更新时间（自动更新） */
  @UpdateDateColumn({
    type: 'datetime',
    name: 'updated_at',
    comment: '角色更新时间（自动更新）',
  })
  updatedAt?: Date

  /**
   * 关联的系统实体（多对一：多个角色可以属于同一个系统）
   */
  @ManyToOne(() => System, (system) => system.roles, {
    onDelete: 'SET NULL', // 系统删除时，设置为NULL（变为全局角色）
    cascade: false,
  })
  @JoinColumn({ name: 'system_id' })
  system?: System

  /**
   * 反向关联：当前角色绑定的所有权限
   * 通过 RolePermissionRelation 与 Permission 建立多对多关系
   */
  @OneToMany(() => RolePermissionRelation, (relation) => relation.role)
  permissionRelations?: RolePermissionRelation[]

  /**
   * 反向关联：当前角色被哪些用户使用
   * 通过 UserRoleRelation 与 User 建立多对多关系
   */
  @OneToMany(() => UserRoleRelation, (relation) => relation.role)
  userRelations?: UserRoleRelation[]
}
