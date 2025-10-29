import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { Permission } from './Permission.entity'
// 需提前创建 Role 实体（此处仅引入，确保项目中存在 Role 实体类）
import { Role } from './Role.entity'

/**
 * 角色-权限关联表实体
 * 实现角色与权限的多对多关系，确保同一角色不重复绑定同一权限
 */
@Entity('role_permission_relation')
// 联合唯一索引：防止同一角色重复绑定同一权限
@Unique(['roleId', 'permissionId'])
export class RolePermissionRelation {
  /** 关联记录唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id?: number

  /** 关联的角色ID（外键） */
  @Column({ type: 'bigint', name: 'role_id', comment: '角色ID' })
  roleId?: number

  /** 关联的权限ID（外键） */
  @Column({ type: 'bigint', name: 'permission_id', comment: '权限ID' })
  permissionId?: number

  /** 关联记录创建时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '创建时间',
  })
  createdAt?: Date

  /** 关联的角色实体（多对一：多个关联记录对应一个角色） */
  @ManyToOne(() => Role, (role) => role.permissionRelations, {
    onDelete: 'CASCADE', // 角色删除时，自动删除关联的权限绑定
    cascade: false,
  })
  @JoinColumn({ name: 'role_id' }) // 映射数据库字段 role_id
  role?: Role

  /** 关联的权限实体（多对一：多个关联记录对应一个权限） */
  @ManyToOne(() => Permission, (permission) => permission.roleRelations, {
    onDelete: 'CASCADE', // 权限删除时，自动删除关联的角色绑定
    cascade: false,
  })
  @JoinColumn({ name: 'permission_id' }) // 映射数据库字段 permission_id
  permission?: Permission
}
