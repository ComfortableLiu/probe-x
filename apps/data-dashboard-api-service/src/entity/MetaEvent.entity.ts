import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, UpdateDateColumn } from 'typeorm'
import { EventPropertyRelationEntity } from './EventPropertyRelation.entity'
import { MetaEventStatus } from "@probe-x/shared-types/src"
import { UserEntity } from "@entity/User.entity"

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
  @Index()
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
    name: 'create_time',
    comment: '创建时间',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createTime?: Date

  @Column({
    name: 'create_user_id',
    type: 'int',
    comment: '创建用户ID',
  })
  createUserId?: number

  @ManyToOne(() => UserEntity, user => user.userId)
  @JoinColumn({ name: 'create_user_id', referencedColumnName: 'userId' })
  createUser?: UserEntity

  @Column({
    name: 'update_user_id',
    type: 'int',
    comment: '更新用户ID',
  })
  updateUserId?: number

  @ManyToOne(() => UserEntity, user => user.userId)
  @JoinColumn({ name: 'update_user_id', referencedColumnName: 'userId' })
  updateUser?: UserEntity

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
