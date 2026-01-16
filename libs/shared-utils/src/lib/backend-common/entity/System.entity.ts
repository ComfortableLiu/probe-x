import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { TrackingNodeEntity } from './TrackingNode.entity'

/**
 * 系统表实体
 * 存储系统中的业务系统信息，与SPM第一层节点（业务线/站点）关联
 * 用于实现系统维度的权限管理
 */
@Entity('system', {
  comment: '系统表：存储系统中的业务系统信息，与SPM第一层节点（业务线/站点）关联，用于实现系统维度的权限管理',
})
export class System {
  /** 系统唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id?: number

  /** 系统标识（唯一，如 "web"、"app"），用于权限判断 */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'system_key',
    unique: true,
    comment: '系统标识（唯一，用于权限判断，只能包含小写字母、数字和下划线）',
  })
  @Index()
  systemKey?: string

  /** 系统显示名称（唯一，如 "Web系统"、"App系统"），用于前端页面展示 */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'system_name',
    unique: true,
    comment: '系统显示名称（唯一，用于前端页面展示）',
  })
  systemName?: string

  /** 系统描述（可选，说明系统的用途和范围） */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'description',
    nullable: true,
    comment: '系统描述（可选，说明系统的用途和范围）',
  })
  description?: string

  /** 关联的SPM第一层节点Code（业务线/站点），关联到tracking_node表 */
  @Column({
    type: 'varchar',
    length: 16,
    name: 'tracking_node_code',
    nullable: true,
    comment: '关联的SPM第一层节点Code（业务线/站点），关联到tracking_node表',
    collation: 'utf8mb4_unicode_ci', // 显式指定 collation，确保与 tracking_node.code 一致
  })
  @Index()
  trackingNodeCode?: string

  /** 是否启用（1=启用，0=禁用），默认启用 */
  @Column({
    type: 'tinyint',
    name: 'is_enable',
    default: 1,
    comment: '是否启用（1=启用，0=禁用），默认启用',
  })
  isEnable?: number

  /** 系统创建时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '系统创建时间（自动填充）',
  })
  createdAt?: Date

  /** 系统更新时间（自动更新） */
  @UpdateDateColumn({
    type: 'datetime',
    name: 'updated_at',
    comment: '系统更新时间（自动更新）',
  })
  updatedAt?: Date

  /**
   * 关联的SPM第一层节点实体（多对一：多个系统可以关联同一个节点，但通常是一对一）
   */
  @ManyToOne(() => TrackingNodeEntity, {
    onDelete: 'SET NULL', // 节点删除时，设置为NULL
    cascade: false,
  })
  @JoinColumn({ name: 'tracking_node_code', referencedColumnName: 'code' })
  trackingNode?: TrackingNodeEntity

  /**
   * 反向关联：当前系统下的所有角色（延迟导入避免循环引用）
   */
  @OneToMany('Role', 'system')
  roles?: any[]

  /**
   * 反向关联：当前系统下的所有权限（延迟导入避免循环引用）
   */
  @OneToMany('Permission', 'system')
  permissions?: any[]
}
