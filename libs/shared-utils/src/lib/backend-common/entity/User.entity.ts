import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { UserRoleRelation } from "./UserRoleRelation.entity"

@Entity('user')
export class UserEntity {
  @PrimaryGeneratedColumn({
    name: 'user_id',
  })
  @Index()
  userId?: number

  @Column({
    name: 'username',
    type: 'varchar',
    length: 50,
    unique: true,
    comment: '用户名',
  })
  @Index()
  username?: string

  @Column({
    name: 'email',
    type: 'varchar',
    length: 100,
    unique: true,
    comment: '邮箱地址',
  })
  @Index()
  email?: string

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    comment: '密码哈希值',
  })
  passwordHash?: string

  @Column({
    name: 'nickname',
    type: 'varchar',
    length: 50,
    comment: '名字',
  })
  nickname?: string

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
    comment: '用户是否激活',
  })
  isActive?: boolean

  @CreateDateColumn({
    name: 'created_at',
    comment: '创建时间',
  })
  createdAt?: Date

  @UpdateDateColumn({
    name: 'updated_at',
    comment: '更新时间',
  })
  updatedAt?: Date

  @Column({
    name: 'last_login',
    type: 'datetime',
    nullable: true,
    comment: '最后登录时间',
  })
  lastLogin?: Date

  /** 角色关联的所有权限绑定记录 */
  @OneToMany(() => UserRoleRelation, (relation) => relation.user, {
    onDelete: 'CASCADE', // 角色删除时，自动删除关联的权限绑定
    cascade: false,
  })
  roleRelations?: UserRoleRelation[]
}
