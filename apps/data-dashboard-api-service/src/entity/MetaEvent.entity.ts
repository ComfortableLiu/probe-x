import { Column, CreateDateColumn, Entity, OneToMany, UpdateDateColumn } from 'typeorm'
import { EventPropertyRelationEntity } from './EventPropertyRelation.entity'
import { MetaEventStatus } from "./type/MetaEvent"

@Entity('meta_event')
export class MetaEventEntity {
  @Column({
    primary: true,
    name: 'event_name',
    type: 'varchar',
    length: 255,
    comment: '事件名称',
    unique: true,
  })
  eventName?: string

  @Column({
    name: 'event_aliases',
    type: 'varchar',
    length: 255,
    comment: '事件别称',
    default: '',
  })
  eventAliases?: string

  @Column({
    name: 'event_remark',
    type: 'text',
    comment: '事件备注',
    default: '',
  })
  eventRemark?: string

  @CreateDateColumn({
    name: 'creat_time',
    comment: '创建时间',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  creatTime?: Date

  @Column({
    name: 'creat_user_id',
    type: 'int',
    comment: '创建用户ID',
  })
  creatUserId?: number

  @Column({
    name: 'update_user_id',
    type: 'int',
    comment: '更新用户ID',
  })
  updateUserId?: number

  @UpdateDateColumn({
    name: 'update_time',
    comment: '更新时间',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updateTime?: Date

  @Column({
    name: 'status',
    comment: '事件状态',
    default: MetaEventStatus.VALID,
    type: 'enum',
    enum: MetaEventStatus,
  })
  status?: MetaEventStatus

  @OneToMany(() => EventPropertyRelationEntity, eventPropertyRelation => eventPropertyRelation.metaEvent)
  eventPropertyRelations?: EventPropertyRelationEntity[]
}
