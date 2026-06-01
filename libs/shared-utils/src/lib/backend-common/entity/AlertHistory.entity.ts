import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 告警历史表实体
 * 记录每次告警触发的历史
 */
@Entity('alert_history', {
  comment: '告警历史表：记录每次告警触发的历史',
})
export class AlertHistoryEntity {
  /** 历史唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id?: number

  /** 告警规则ID */
  @Column({
    type: 'bigint',
    name: 'alert_rule_id',
    comment: '告警规则ID',
  })
  @Index()
  alertRuleId?: number

  /** 规则名称（冗余，避免关联查询） */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'rule_name',
    comment: '规则名称（冗余）',
  })
  ruleName?: string

  /** 告警级别（warning/critical） */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'alert_level',
    comment: '告警级别（warning/critical）',
  })
  @Index()
  alertLevel?: string

  /** 告警内容 */
  @Column({
    type: 'text',
    name: 'alert_content',
    comment: '告警内容',
  })
  alertContent?: string

  /** 通知状态（pending/sent/failed） */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'notify_status',
    default: 'pending',
    comment: '通知状态（pending/sent/failed）',
  })
  notifyStatus?: string

  /** 触发时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '触发时间（自动填充）',
  })
  @Index()
  createdAt?: Date
}
