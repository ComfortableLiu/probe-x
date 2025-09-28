import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { MetaPropertyStatus, MetaPropertyType } from "@entity/type/MetaProperty"
import { EventPropertyRelationEntity } from './EventPropertyRelation.entity'

@Entity('meta_property')
export class MetaPropertyEntity {
  @PrimaryColumn({
    name: 'property_name',
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true,
    comment: '属性名称',
  })
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
    name: 'creat_time',
    comment: '创建时间',
    type: 'datetime',
    nullable: false,
    update: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  creatTime?: Date

  @Column({
    name: 'creat_user_id',
    comment: '创建用户ID',
    type: 'int',
    nullable: false,
  })
  creatUserId?: number

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
