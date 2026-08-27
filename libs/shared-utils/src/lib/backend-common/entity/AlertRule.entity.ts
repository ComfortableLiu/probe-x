import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * 告警规则表实体
 * 存储阈值告警规则：某事件在时间窗内的次数满足比较条件时触发
 */
@Entity('alert_rule', {
  comment: '告警规则表：存储阈值告警规则的配置信息',
})
export class AlertRuleEntity {
  /** 规则唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id?: number

  /** 规则名称 */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'name',
    comment: '规则名称',
  })
  name?: string

  /** 监控事件名称（对应 ClickHouse 事件的 $event_name） */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'event_name',
    comment: '监控事件名称',
  })
  @Index()
  eventName?: string

  /** 统计时间窗（分钟） */
  @Column({
    type: 'int',
    name: 'window_minutes',
    default: 60,
    comment: '统计时间窗（分钟）',
  })
  windowMinutes?: number

  /** 巡检间隔（分钟） */
  @Column({
    type: 'int',
    name: 'check_interval_minutes',
    default: 5,
    comment: '巡检间隔（分钟）',
  })
  checkIntervalMinutes?: number

  /** 比较运算符（>/</>=/<=/==） */
  @Column({
    type: 'varchar',
    length: 4,
    name: 'operator',
    comment: '比较运算符（>/</>=/<=/==）',
  })
  operator?: string

  /** 阈值 */
  @Column({
    type: 'double',
    name: 'threshold',
    comment: '阈值',
  })
  threshold?: number

  /** 告警级别（info/warning/critical） */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'level',
    default: 'warning',
    comment: '告警级别（info/warning/critical）',
  })
  level?: string

  /** 告警通知 Webhook 地址 */
  @Column({
    type: 'varchar',
    length: 500,
    name: 'webhook_url',
    comment: '告警通知 Webhook 地址',
  })
  webhookUrl?: string

  /** 是否启用（1=启用，0=禁用） */
  @Column({
    type: 'tinyint',
    name: 'enabled',
    default: 1,
    comment: '是否启用（1=启用，0=禁用）',
  })
  @Index()
  enabled?: number

  /** 最后巡检时间 */
  @Column({
    type: 'datetime',
    name: 'last_checked_at',
    nullable: true,
    comment: '最后巡检时间',
  })
  lastCheckedAt?: Date

  /** 最后触发时间 */
  @Column({
    type: 'datetime',
    name: 'last_triggered_at',
    nullable: true,
    comment: '最后触发时间',
  })
  lastTriggeredAt?: Date

  /** 创建者ID */
  @Column({
    type: 'int',
    name: 'create_user_id',
    nullable: true,
    comment: '创建者ID',
  })
  createUserId?: number

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
