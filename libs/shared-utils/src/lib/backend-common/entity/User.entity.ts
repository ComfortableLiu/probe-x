import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { UserRoleRelation } from "./UserRoleRelation.entity"

/**
 * 用户表实体
 * 存储系统中的用户基本信息，包括登录凭证、个人信息等
 * 通过 UserRoleRelation 与 Role 建立多对多关系，实现用户-角色-权限的权限体系
 */
@Entity('user', {
  comment: '用户表：存储系统中的用户基本信息，包括登录凭证、个人信息等。通过 UserRoleRelation 与 Role 建立多对多关系，实现用户-角色-权限的权限体系',
})
export class UserEntity {
  /** 用户唯一ID（自增） */
  @PrimaryGeneratedColumn({
    name: 'user_id',
  })
  @Index()
  userId?: number

  /** 用户名（唯一，用于登录），不可重复 */
  @Column({
    name: 'username',
    type: 'varchar',
    length: 50,
    unique: true,
    comment: '用户名（唯一，用于登录），不可重复',
  })
  @Index()
  username?: string

  /** 邮箱地址（唯一，可用于登录和找回密码），可选 */
  @Column({
    name: 'email',
    type: 'varchar',
    length: 100,
    unique: true,
    comment: '邮箱地址（唯一，可用于登录和找回密码），可选',
  })
  @Index()
  email?: string

  /** 密码哈希值（存储加密后的密码，不存储明文） */
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    comment: '密码哈希值（存储加密后的密码，不存储明文）',
  })
  passwordHash?: string

  /** 昵称（显示名称，用于前端展示） */
  @Column({
    name: 'nickname',
    type: 'varchar',
    length: 50,
    comment: '昵称（显示名称，用于前端展示）',
  })
  nickname?: string

  /** 用户是否激活（true=激活，false=禁用），禁用用户无法登录 */
  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
    comment: '用户是否激活（true=激活，false=禁用），禁用用户无法登录',
  })
  isActive?: boolean

  /** 用户创建时间（自动填充） */
  @CreateDateColumn({
    name: 'created_at',
    comment: '用户创建时间（自动填充）',
  })
  createdAt?: Date

  /** 用户信息更新时间（自动更新） */
  @UpdateDateColumn({
    name: 'updated_at',
    comment: '用户信息更新时间（自动更新）',
  })
  updatedAt?: Date

  /** 最后登录时间（用户每次登录时更新），可选 */
  @Column({
    name: 'last_login',
    type: 'datetime',
    nullable: true,
    comment: '最后登录时间（用户每次登录时更新），可选',
  })
  lastLogin?: Date

  /**
   * 反向关联：当前用户拥有的所有角色
   * 通过 UserRoleRelation 与 Role 建立多对多关系
   * 用户删除时，级联删除所有角色关联记录
   */
  @OneToMany(() => UserRoleRelation, (relation) => relation.user, {
    onDelete: 'CASCADE', // 用户删除时，自动删除关联的角色绑定
    cascade: false,
  })
  roleRelations?: UserRoleRelation[]
}
