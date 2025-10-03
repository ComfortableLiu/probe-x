import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { RolePermissionRelation } from './RolePermissionRelation.entity'
import { UserRoleRelation } from "@entity/UserRoleRelation.entity"

@Entity('role')
export class Role {

  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number

  /** 权限显示名（如“新增用户”），用于前端页面展示 */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'role_key',
    comment: '角色Key',
  })
  roleKey: string

  @Column({
    type: 'varchar',
    length: 100,
    name: 'role_name',
    unique: true,
    comment: '角色展示名',
  })
  roleName: string

  @Column({
    type: 'varchar',
    length: 255,
    name: 'description',
    nullable: true,
    comment: '角色描述',
  })
  description?: string

  @Column({
    type: 'boolean',
    name: 'is_enable',
    default: true,
    comment: '是否启用',
  })
  isEnable: number

  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '创建时间',
  })
  createdAt: Date

  @UpdateDateColumn({
    type: 'datetime',
    name: 'updated_at',
    comment: '更新时间',
  })
  updatedAt: Date


  /** 角色关联的所有权限绑定记录 */
  @OneToMany(() => RolePermissionRelation, (relation) => relation.role)
  permissionRelations: RolePermissionRelation[]

  /** 角色关联的所有权限绑定记录 */
  @OneToMany(() => UserRoleRelation, (relation) => relation.role)
  userRelations: UserRoleRelation[]
}
