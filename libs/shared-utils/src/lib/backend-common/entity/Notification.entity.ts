import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * 通知配置表实体
 * 存储系统中通知规则的配置信息
 */
@Entity('notification', {
  comment: '通知配置表：存储系统中通知规则的配置信息',
})
export class NotificationEntity {
  /** 通知配置唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id?: number

  /** 通知名称 */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'notification_name',
    comment: '通知名称',
  })
  notificationName?: string

  /** 通知类型（webhook/email/sms） */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'notification_type',
    comment: '通知类型（webhook/email/sms）',
  })
  notificationType?: string

  /** 接收人（邮箱地址、手机号、Webhook URL 等） */
  @Column({
    type: 'varchar',
    length: 500,
    name: 'recipients',
    comment: '接收人（邮箱地址、手机号、Webhook URL 等）',
  })
  recipients?: string

  /** 触发条件描述 */
  @Column({
    type: 'varchar',
    length: 500,
    name: 'trigger_condition',
    nullable: true,
    comment: '触发条件描述',
  })
  triggerCondition?: string

  /** 通知配置（JSON 格式，存储 Webhook URL、SMTP 配置等） */
  @Column({
    type: 'text',
    name: 'config',
    comment: '通知配置（JSON 格式）',
  })
  config?: string

  /** 是否启用（1=启用，0=禁用） */
  @Column({
    type: 'tinyint',
    name: 'is_enable',
    default: 1,
    comment: '是否启用（1=启用，0=禁用）',
  })
  isEnable?: number

  /** 最后发送时间 */
  @Column({
    type: 'datetime',
    name: 'last_send_time',
    nullable: true,
    comment: '最后发送时间',
  })
  lastSendTime?: Date

  /** 描述 */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'description',
    nullable: true,
    comment: '描述',
  })
  description?: string

  /** 创建时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '创建时间（自动填充）',
  })
  createdAt?: Date

  /** 更新时间（自动更新） */
  @UpdateDateColumn({
    type: 'datetime',
    name: 'updated_at',
    comment: '更新时间（自动更新）',
  })
  updatedAt?: Date
}
