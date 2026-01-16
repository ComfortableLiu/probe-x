import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'
import { UserEntity } from "./User.entity"
import { TrackingNodeLevel, TrackingNodeStatus, TrackingNodeType } from "@probe-x/shared-types/src"

/**
 * SPM/SCM统一节点实体
 * 采用自引用实现树形结构，支持四层结构
 */
@Entity('tracking_node')
export class TrackingNodeEntity {

  /**
   * 节点编码 (当前层级的唯一标识)
   */
  @PrimaryColumn({
    type: 'varchar',
    comment: '节点编码，生成规则是0-9a-zA-Z随机16个',
    length: 16,
    collation: 'utf8mb4_unicode_ci', // 显式指定 collation，确保与 system.tracking_node_code 一致
  })
  @Index()
  code?: string

  /**
   * 节点类型 (SPM或SCM)
   */
  @Column({
    type: 'enum',
    enum: TrackingNodeType,
    comment: '节点类型: spm或scm',
  })
  @Index()
  type?: TrackingNodeType

  /**
   * 节点层级 (1-4)
   */
  @Column({
    type: 'enum',
    enum: TrackingNodeLevel,
    comment: '节点层级: 1-4',
  })
  @Index()
  level?: TrackingNodeLevel

  /**
   * 节点名称
   */
  @Column({ length: 100, comment: '节点名称' })
  name?: string

  /**
   * 节点描述
   */
  @Column({ length: 500, nullable: true, comment: '节点描述' })
  description?: string

  /**
   * 父节点Code (自引用)
   * 层级1没有父节点
   */
  @Column({ nullable: true, comment: '父节点Code' })
  @Index()
  parentCode?: string

  /**
   * 父节点关联
   */
  @ManyToOne(() => TrackingNodeEntity, node => node.children, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'parentId' })
  parent?: TrackingNodeEntity

  /**
   * 子节点关联
   */
  @OneToMany(() => TrackingNodeEntity, node => node.parent)
  children?: TrackingNodeEntity[]

  @Column({
    name: 'status',
    comment: '状态',
    default: TrackingNodeStatus.VALID,
    type: 'enum',
    enum: TrackingNodeStatus,
  })
  status?: TrackingNodeStatus

  @CreateDateColumn({
    name: 'create_time',
    comment: '创建时间',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createTime?: Date

  @Column({
    name: 'create_user_id',
    type: 'int',
    comment: '创建用户ID',
  })
  createUserId?: number

  @ManyToOne(() => UserEntity, user => user.userId)
  @JoinColumn({ name: 'create_user_id', referencedColumnName: 'userId' })
  createUser?: UserEntity

  @Column({
    name: 'update_user_id',
    type: 'int',
    comment: '更新用户ID',
  })
  updateUserId?: number

  @ManyToOne(() => UserEntity, user => user.userId)
  @JoinColumn({ name: 'update_user_id', referencedColumnName: 'userId' })
  updateUser?: UserEntity

  @UpdateDateColumn({
    name: 'update_time',
    comment: '更新时间',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updateTime?: Date
}
