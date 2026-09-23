import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

/**
 * 统计游标表
 *
 * 通用 KV 形态：一行一个同步任务的进度，UTM 统计用 name = 'utm'，
 * 未来每日清洗等批次任务也可以复用本表记各自的进度。
 *
 * cursor_date 的语义是「已统计到的日期（含）」，只前进不回退，
 * 保证同一天的量不会被二次累加。
 */
@Entity('sync_cursor', {
  comment: '统计游标表：记录各统计任务已同步到的日期',
})
export class SyncCursorEntity {

  /**
   * 游标名称（如 utm）
   */
  @PrimaryColumn({
    type: 'varchar',
    length: 64,
    name: 'name',
    comment: '游标名称，如 utm',
  })
  name?: string

  /**
   * 已统计到的日期（含）
   */
  @Column({
    type: 'date',
    name: 'cursor_date',
    comment: '已统计到的日期（含），只前进不回退',
  })
  cursorDate?: string

  @UpdateDateColumn({
    name: 'update_time',
    comment: '更新时间',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  updateTime?: Date
}
