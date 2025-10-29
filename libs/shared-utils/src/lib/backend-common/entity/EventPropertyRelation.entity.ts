import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { MetaEventEntity } from './MetaEvent.entity'
import { MetaPropertyEntity } from './MetaProperty.entity'
import { EventPropertyRelationStatus } from "@probe-x/shared-types/src"
import { UserEntity } from "./User.entity"

@Entity('event_property_relation')
export class EventPropertyRelationEntity {

  @PrimaryGeneratedColumn()
  id?: number

  @Column({
    name: 'event_property_remark',
    type: 'text',
    comment: '当前事件的属性说明备注',
    default: '',
  })
  eventPropertyRemark?: string

  @CreateDateColumn({
    name: 'create_time',
    type: 'datetime',
    comment: '创建时间',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createTime?: Date

  @Column({
    name: 'create_user_id',
    type: 'int',
    comment: '创建用户id',
    nullable: false,
  })
  createUserId?: number

  @ManyToOne(() => UserEntity, user => user.userId)
  @JoinColumn({ name: 'create_user_id', referencedColumnName: 'userId' })
  createUser?: UserEntity

  @Column({
    name: 'update_time',
    type: 'datetime',
    comment: '更新时间',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  updateTime?: Date

  @Column({
    name: 'update_user_id',
    type: 'int',
    comment: '更新用户id',
    nullable: false,
  })
  updateUserId?: number

  @ManyToOne(() => UserEntity, user => user.userId)
  @JoinColumn({ name: 'update_user_id', referencedColumnName: 'userId' })
  updateUser?: UserEntity

  @Column({
    name: 'status',
    comment: '状态，预留字段',
    type: 'enum',
    enum: EventPropertyRelationStatus,
    default: EventPropertyRelationStatus.VALID,
  })
  status?: EventPropertyRelationStatus

  @ManyToOne(() => MetaEventEntity, metaEvent => metaEvent.eventPropertyRelations)
  @JoinColumn({ name: 'event_name' })
  metaEvent?: MetaEventEntity

  @ManyToOne(() => MetaPropertyEntity, metaProperty => metaProperty.eventPropertyRelations)
  @JoinColumn({ name: 'property_name' })
  metaProperty?: MetaPropertyEntity
}
