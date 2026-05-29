import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { UserProjectRelation } from './UserProjectRelation.entity'

/**
 * 项目表实体（多租户隔离）
 * 存储系统中的项目信息，用于数据隔离
 */
@Entity('project', {
  comment: '项目表：存储系统中的项目信息，用于多租户数据隔离',
})
export class ProjectEntity {
  /** 项目唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id?: number

  /** 项目名称 */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'project_name',
    comment: '项目名称',
  })
  projectName?: string

  /** 项目标识（全局唯一） */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'project_key',
    unique: true,
    comment: '项目标识（全局唯一）',
  })
  @Index()
  projectKey?: string

  /** 项目描述 */
  @Column({
    type: 'varchar',
    length: 500,
    name: 'description',
    nullable: true,
    comment: '项目描述',
  })
  description?: string

  /** 是否启用（1=启用，0=禁用） */
  @Column({
    type: 'tinyint',
    name: 'is_enable',
    default: 1,
    comment: '是否启用（1=启用，0=禁用）',
  })
  isEnable?: number

  /** 创建时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '创建时间（自动填充）',
  })
  createdAt?: Date

  /** 更新时间（自动更新） */
  @UpdateDateColumn({
    type: 'datetime',
    name: 'updated_at',
    comment: '更新时间（自动更新）',
  })
  updatedAt?: Date

  /** 反向关联：项目成员关系 */
  @OneToMany(() => UserProjectRelation, (relation) => relation.project, {
    onDelete: 'CASCADE',
    cascade: false,
  })
  memberRelations?: UserProjectRelation[]
}
