import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { RolePermissionRelation } from './RolePermissionRelation.entity'

/**
 * 权限表实体
 * 存储系统中所有细粒度权限（如菜单、按钮、接口权限）
 */
@Entity('permission')
export class Permission {
  /** 权限唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id: number

  /** 权限标识（格式：资源:操作，如 user:add），唯一不可重复 */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'permission_key',
    unique: true,
    comment: '权限标识（资源:操作）',
  })
  @Index()
  permissionKey: string

  /** 权限显示名（如“新增用户”），用于前端页面展示 */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'permission_name',
    comment: '权限显示名',
  })
  permissionName: string

  /** 权限描述（如“允许新增系统用户，仅管理员可用”） */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'description',
    nullable: true,
    comment: '权限描述',
  })
  description?: string

  /** 权限是否启用（1=启用，0=禁用），默认启用 */
  @Column({
    type: 'boolean',
    name: 'is_enable',
    default: true,
    comment: '是否启用',
  })
  isEnable: number

  /** 权限创建时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '创建时间',
  })
  createdAt: Date

  /** 权限更新时间（自动更新） */
  @UpdateDateColumn({
    type: 'datetime',
    name: 'updated_at',
    comment: '更新时间',
  })
  updatedAt: Date

  /**
   * 反向关联：当前权限被哪些角色绑定
   * 通过 RolePermissionRelation 与 Role 建立多对多关系
   */
  @OneToMany(() => RolePermissionRelation, (relation) => relation.permission)
  roleRelations: RolePermissionRelation[]
}
