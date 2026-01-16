import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { UserEntity } from './User.entity'
import { Role } from './Role.entity'
import { System } from './System.entity'

/**
 * 用户-角色关联表实体
 * 实现用户与角色的多对多关系，支持一个用户拥有多个角色，一个角色包含多个用户
 * 支持系统维度：system_id用于标识用户在特定系统中的角色
 */
@Entity('user_role_relation', {
  comment: '用户-角色关联表：实现用户与角色的多对多关系，支持一个用户拥有多个角色，一个角色包含多个用户。支持系统维度：system_id用于标识用户在特定系统中的角色。用户或角色删除时，级联删除关联记录',
})
// 联合唯一索引：确保同一用户在同一系统中不会重复绑定同一角色
@Unique(['userId', 'roleId', 'systemId'])
export class UserRoleRelation {
  /** 关联记录唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id?: number

  /** 关联的用户ID（外键） */
  @Column({ type: 'bigint', name: 'user_id', comment: '关联的用户ID（外键），用户删除时级联删除' })
  userId?: number

  /** 关联的角色ID（外键） */
  @Column({ type: 'bigint', name: 'role_id', comment: '关联的角色ID（外键），角色删除时级联删除' })
  roleId?: number

  /** 关联的系统ID（NULL表示全局角色关联，有值表示系统级角色关联） */
  @Column({
    type: 'bigint',
    name: 'system_id',
    nullable: true,
    comment: '关联的系统ID（NULL表示全局角色关联，有值表示系统级角色关联）',
  })
  @Index()
  systemId?: number

  /** 关联记录创建时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '关联记录创建时间（自动填充）',
  })
  createdAt?: Date

  /**
   * 关联的用户实体（多对一：多个关联记录对应一个用户）
   * 用户删除时，级联删除所有相关的角色绑定记录
   */
  @ManyToOne(() => UserEntity, (user) => user.roleRelations, {
    onDelete: 'CASCADE', // 用户删除时，自动删除关联的角色绑定
    cascade: false,
  })
  @JoinColumn({ name: 'user_id' }) // 映射数据库字段 user_id
  user?: UserEntity

  /**
   * 关联的角色实体（多对一：多个关联记录对应一个角色）
   * 角色删除时，级联删除所有相关的用户绑定记录
   */
  @ManyToOne(() => Role, (role) => role.userRelations, {
    onDelete: 'CASCADE', // 角色删除时，自动删除关联的用户绑定
    cascade: false,
  })
  @JoinColumn({ name: 'role_id' }) // 映射数据库字段 role_id
  role?: Role

  /**
   * 关联的系统实体（多对一：多个关联记录对应一个系统）
   */
  @ManyToOne(() => System, {
    onDelete: 'SET NULL', // 系统删除时，设置为NULL
    cascade: false,
  })
  @JoinColumn({ name: 'system_id' })
  system?: System
}
