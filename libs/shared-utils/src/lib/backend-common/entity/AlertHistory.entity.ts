import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 告警历史表实体
 * 记录每次告警触发及 Webhook 通知结果
 */
@Entity('alert_history', {
  comment: '告警历史表：记录每次告警触发及 Webhook 通知结果',
})
export class AlertHistoryEntity {
  /** 历史唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id?: number

  /** 告警规则ID */
  @Column({
    type: 'bigint',
    name: 'rule_id',
    comment: '告警规则ID',
  })
  @Index()
  ruleId?: number

  /** 触发时的指标值（时间窗内事件次数） */
  @Column({
    type: 'double',
    name: 'metric_value',
    comment: '触发时的指标值',
  })
  metricValue?: number

  /** 触发时的阈值 */
  @Column({
    type: 'double',
    name: 'threshold',
    comment: '触发时的阈值',
  })
  threshold?: number

  /** 告警级别（info/warning/critical） */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'level',
    comment: '告警级别（info/warning/critical）',
  })
  @Index()
  level?: string

  /** Webhook 发送结果（success/failed） */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'webhook_status',
    comment: 'Webhook 发送结果（success/failed）',
  })
  webhookStatus?: string

  /** 失败原因 */
  @Column({
    type: 'text',
    name: 'error',
    nullable: true,
    comment: '失败原因',
  })
  error?: string

  /** 触发时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '触发时间（自动填充）',
  })
  @Index()
  createdAt?: Date
}
