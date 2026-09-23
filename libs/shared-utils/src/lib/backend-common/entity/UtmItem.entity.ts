import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { UtmDimension } from '@probe-x/shared-types/src'

/**
 * UTM 条目表
 * 按维度存储 ClickHouse 里出现过的 UTM 取值，附带用户维护的别名/描述与累计统计。
 * 管理侧按维度分别管理（一个维度下的一个取值一行），未来的 UTM 分析再做 5 维联合查询。
 *
 * 可空列统一用 `T | null` 类型，以便用户「清空」时能真正写回 NULL
 * （TypeORM 的 save/update 会跳过 undefined，只有 null 才会进 SET 子句）。
 */
@Entity('utm_item', {
  comment: 'UTM 条目表：按维度存储出现过的 UTM 取值，附带用户维护的别名/描述与累计统计',
})
@Index(['dimension', 'value'], { unique: true })
export class UtmItemEntity {

  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id?: number

  /**
   * UTM 维度
   */
  @Column({
    type: 'enum',
    enum: UtmDimension,
    name: 'dimension',
    comment: 'UTM 维度: source/medium/campaign/term/content',
  })
  dimension?: UtmDimension

  /**
   * UTM 原始取值
   *
   * 显式指定 utf8mb4_bin：ClickHouse 的 GROUP BY 是字节精确的，
   * 库默认的 utf8mb4_unicode_ci 会把 Google / google 判为同一条导致 upsert 撞车、统计口径出错
   */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'value',
    collation: 'utf8mb4_bin',
    comment: 'UTM 原始取值（大小写敏感，与 ClickHouse 字节精确一致）',
  })
  value?: string

  /**
   * 别名（用户维护的可读名称，如「2026春节微信投放」）
   */
  @Column({ length: 255, nullable: true, name: 'alias', comment: '别名' })
  alias?: string | null

  /**
   * 描述
   */
  @Column({ length: 500, nullable: true, name: 'description', comment: '描述' })
  description?: string | null

  /**
   * 累计事件数
   * 只存可精确累加的指标：访客数/会话数这类去重指标跨天无法简单累加，留给未来的 UTM 分析按需现算
   */
  @Column({ type: 'bigint', name: 'event_count', default: 0, comment: '累计事件数（每日累加，精确）' })
  eventCount?: number

  /**
   * 首次出现日期
   */
  @Column({ type: 'date', name: 'first_seen_date', nullable: true, comment: '首次出现日期' })
  firstSeenDate?: string | null

  /**
   * 末次出现日期
   */
  @Column({ type: 'date', name: 'last_seen_date', nullable: true, comment: '末次出现日期' })
  lastSeenDate?: string | null

  /**
   * 软删除标记
   * 不物理删除；标记后后续统计不再计入该取值（计数冻结），UTM 分析也忽略它
   */
  @Column({
    type: 'tinyint',
    name: 'is_deleted',
    default: 0,
    comment: '软删除标记（1=已删除，不再统计）',
  })
  @Index()
  isDeleted?: number

  /**
   * 删除时间
   */
  @Column({ type: 'datetime', name: 'deleted_at', nullable: true, comment: '删除时间' })
  deletedAt?: Date | null

  /**
   * 删除用户ID
   */
  @Column({ type: 'int', name: 'deleted_user_id', nullable: true, comment: '删除用户ID' })
  deletedUserId?: number | null

  /**
   * 创建时间
   * 条目由统计任务写入，没有操作人，因此 create_user_id 可为空
   */
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
    nullable: true,
    comment: '创建用户ID（条目由统计任务写入，无操作人时为空）',
  })
  createUserId?: number | null

  @Column({
    name: 'update_user_id',
    type: 'int',
    nullable: true,
    comment: '更新用户ID',
  })
  updateUserId?: number | null

  @UpdateDateColumn({
    name: 'update_time',
    comment: '更新时间',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  updateTime?: Date
}
