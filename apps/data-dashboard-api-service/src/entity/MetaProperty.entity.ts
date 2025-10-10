import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, UpdateDateColumn } from 'typeorm'
import { EventPropertyRelationEntity } from './EventPropertyRelation.entity'
import { MetaPropertyBusinessType, MetaPropertyStatus, MetaPropertyType } from "@probe-x/shared-types/src"
import { UserEntity } from "@entity/User.entity"

@Entity('meta_property')
export class MetaPropertyEntity {
  @Column({
    primary: true,
    name: 'property_name',
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true,
    comment: '属性名称',
  })
  @Index()
  propertyName?: string

  @Column({
    name: 'property_type',
    comment: '属性类型',
    type: 'enum',
    enum: MetaPropertyType,
    default: MetaPropertyType.STRING,
  })
  propertyType?: MetaPropertyType

  @CreateDateColumn({
    name: 'create_time',
    comment: '创建时间',
    type: 'datetime',
    nullable: false,
    update: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createTime?: Date

  @Column({
    name: 'create_user_id',
    comment: '创建用户ID',
    type: 'int',
    nullable: false,
  })
  createUserId?: number

  @ManyToOne(() => UserEntity, user => user.userId)
  @JoinColumn({ name: 'create_user_id', referencedColumnName: 'userId' })
  createUser?: UserEntity

  @UpdateDateColumn({
    name: 'update_time',
    comment: '更新时间',
    type: 'datetime',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  updateTime?: Date

  @Column({
    name: 'update_user_id',
    comment: '更新用户ID',
    type: 'int',
    nullable: false,
  })
  updateUserId?: number

  @ManyToOne(() => UserEntity, user => user.userId)
  @JoinColumn({ name: 'update_user_id', referencedColumnName: 'userId' })
  updateUser?: UserEntity

  @Column({
    name: 'type',
    comment: '属性类型',
    type: 'enum',
    enum: MetaPropertyBusinessType,
    default: MetaPropertyBusinessType.BUSINESS,
  })
  type: MetaPropertyBusinessType

  @Column({
    name: 'status',
    comment: '状态，预留字段，前期还没有什么需要改变属性的功能',
    type: 'enum',
    enum: MetaPropertyStatus,
    default: MetaPropertyStatus.VALID,
  })
  status?: MetaPropertyStatus

  @OneToMany(() => EventPropertyRelationEntity, eventPropertyRelation => eventPropertyRelation.metaProperty)
  eventPropertyRelations?: EventPropertyRelationEntity[]
}
