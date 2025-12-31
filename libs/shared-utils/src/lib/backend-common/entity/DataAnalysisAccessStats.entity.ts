import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * 数据分析功能访问统计实体
 * 用于统计数据分析功能的访问情况
 */
@Entity('data_analysis_access_stats')
export class DataAnalysisAccessStatsEntity {
  @PrimaryGeneratedColumn({
    name: 'id',
    comment: '主键ID',
  })
  id?: number

  @Column({
    name: 'access_date',
    type: 'date',
    comment: '访问日期',
  })
  @Index()
  accessDate?: Date

  @Column({
    name: 'user_id',
    type: 'int',
    comment: '访问用户ID',
  })
  userId?: number

  @Column({
    name: 'user_name',
    type: 'varchar',
    length: 100,
    comment: '访问用户名',
  })
  userName?: string

  @Column({
    name: 'access_time',
    type: 'datetime',
    comment: '访问时间',
  })
  @Index()
  accessTime?: Date

  @Column({
    name: 'access_type',
    type: 'varchar',
    length: 50,
    comment: '访问类型: page_view, api_call等',
  })
  @Index()
  accessType?: string

  @Column({
    name: 'access_path',
    type: 'varchar',
    length: 500,
    comment: '访问路径',
  })
  accessPath?: string

  @Column({
    name: 'ip_address',
    type: 'varchar',
    length: 45,
    comment: 'IP地址',
    nullable: true,
  })
  ipAddress?: string

  @Column({
    name: 'user_agent',
    type: 'varchar',
    length: 500,
    comment: '用户代理',
    nullable: true,
  })
  userAgent?: string

  @Column({
    name: 'session_id',
    type: 'varchar',
    length: 128,
    comment: '会话ID',
    nullable: true,
  })
  sessionId?: string

  @Column({
    name: 'page_stay_duration',
    type: 'int',
    comment: '页面停留时长(秒)',
    nullable: true,
  })
  pageStayDuration?: number

  @CreateDateColumn({
    name: 'create_time',
    comment: '创建时间',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createTime?: Date

  @UpdateDateColumn({
    name: 'update_time',
    comment: '更新时间',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updateTime?: Date
}