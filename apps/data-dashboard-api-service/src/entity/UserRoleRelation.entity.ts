import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { UserEntity } from './User.entity'
import { Role } from './Role.entity'

/**
 * 用户-角色关联表实体
 * 实现用户与角色的多对多关系，支持一个用户拥有多个角色，一个角色包含多个用户
 */
@Entity('user_role_relation')
// 联合唯一索引：确保同一用户不会重复绑定同一角色
@Unique(['userId', 'roleId'])
export class UserRoleRelation {
  /** 关联记录唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number

  /** 关联的用户ID（外键） */
  @Column({ type: 'bigint', name: 'user_id', comment: '用户ID' })
  userId: number

  /** 关联的角色ID（外键） */
  @Column({ type: 'bigint', name: 'role_id', comment: '角色ID' })
  roleId: number

  /** 关联记录创建时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '创建时间',
  })
  createdAt: Date

  /** 关联的用户实体（多对一：多个关联记录对应一个用户） */
  @ManyToOne(() => UserEntity, (user) => user.roleRelations, {
    onDelete: 'CASCADE', // 用户删除时，自动删除关联的角色绑定
    cascade: false,
  })
  @JoinColumn({ name: 'user_id' }) // 映射数据库字段 user_id
  user: UserEntity

  /** 关联的角色实体（多对一：多个关联记录对应一个角色） */
  @ManyToOne(() => Role, (role) => role.userRelations, {
    onDelete: 'CASCADE', // 角色删除时，自动删除关联的用户绑定
    cascade: false,
  })
  @JoinColumn({ name: 'role_id' }) // 映射数据库字段 role_id
  role: Role
}
