import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

/**
 * 通用配置表（KV 形态，一行一个配置项）
 *
 * 当前用于最终数据清洗调度（final_cleaning.enabled / final_cleaning.daily_time），
 * 后续其他全局运行参数也放这里。
 */
@Entity('system_config', {
  comment: '通用配置表：一行一个全局配置项',
})
export class SystemConfigEntity {

  /**
   * 配置键，如 final_cleaning.daily_time
   */
  @PrimaryColumn({
    type: 'varchar',
    length: 100,
    name: 'key',
    comment: '配置键，如 final_cleaning.daily_time',
  })
  key?: string

  /**
   * 配置值
   */
  @Column({
    type: 'text',
    name: 'value',
    nullable: true,
    comment: '配置值',
  })
  value?: string

  @Column({
    type: 'varchar',
    length: 500,
    name: 'description',
    default: '',
    comment: '配置描述',
  })
  description?: string

  @UpdateDateColumn({
    name: 'updated_at',
    comment: '更新时间',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  updatedAt?: Date
}
