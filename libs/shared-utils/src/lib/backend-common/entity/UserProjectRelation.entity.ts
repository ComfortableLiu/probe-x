import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { UserEntity } from './User.entity'
import { ProjectEntity } from './Project.entity'

/**
 * 用户-项目关联表实体
 * 实现用户与项目的多对多关系
 */
@Entity('user_project_relation', {
  comment: '用户-项目关联表：实现用户与项目的多对多关系',
})
export class UserProjectRelation {
  /** 关系唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id?: number

  /** 用户ID */
  @ManyToOne(() => UserEntity, (user) => user.roleRelations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user?: UserEntity

  /** 项目ID */
  @ManyToOne(() => ProjectEntity, (project) => project.memberRelations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  @Index()
  project?: ProjectEntity

  /** 创建时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '创建时间（自动填充）',
  })
  createdAt?: Date
}
