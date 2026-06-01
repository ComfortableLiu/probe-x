import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * 告警规则表实体
 * 存储系统中告警规则的配置信息
 */
@Entity('alert_rule', {
  comment: '告警规则表：存储系统中告警规则的配置信息',
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
    name: 'rule_name',
    comment: '规则名称',
  })
  ruleName?: string

  /** 规则类型（event_count_spike/funnel_conversion_drop/custom） */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'rule_type',
    comment: '规则类型（event_count_spike/funnel_conversion_drop/custom）',
  })
  @Index()
  ruleType?: string

  /** 规则条件（JSON 格式） */
  @Column({
    type: 'text',
    name: 'condition',
    comment: '规则条件（JSON格式）',
  })
  condition?: string

  /** 关联项目ID */
  @Column({
    type: 'bigint',
    name: 'project_id',
    nullable: true,
    comment: '关联项目ID',
  })
  @Index()
  projectId?: number

  /** 关联通知配置ID */
  @Column({
    type: 'bigint',
    name: 'notification_id',
    nullable: true,
    comment: '关联通知配置ID',
  })
  notificationId?: number

  /** 是否启用（1=启用，0=禁用） */
  @Column({
    type: 'tinyint',
    name: 'is_enable',
    default: 1,
    comment: '是否启用（1=启用，0=禁用）',
  })
  isEnable?: number

  /** 描述 */
  @Column({
    type: 'varchar',
    length: 500,
    name: 'description',
    nullable: true,
    comment: '描述',
  })
  description?: string

  /** 最后触发时间 */
  @Column({
    type: 'datetime',
    name: 'last_trigger_time',
    nullable: true,
    comment: '最后触发时间',
  })
  lastTriggerTime?: Date

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
