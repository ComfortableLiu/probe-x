import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * 数据分析查询统计实体
 * 用于统计数据分析功能的使用情况
 */
@Entity('data_analysis_query_stats')
export class DataAnalysisQueryStatsEntity {
  @PrimaryGeneratedColumn({
    name: 'id',
    comment: '主键ID',
  })
  id?: number

  @Column({
    name: 'query_date',
    type: 'date',
    comment: '查询日期',
  })
  @Index()
  queryDate?: Date

  @Column({
    name: 'user_id',
    type: 'int',
    comment: '查询用户ID',
  })
  userId?: number

  @Column({
    name: 'user_name',
    type: 'varchar',
    length: 100,
    comment: '查询用户名',
  })
  userName?: string

  @Column({
    name: 'query_content',
    type: 'text',
    comment: '查询内容',
    nullable: true,
  })
  queryContent?: string

  @Column({
    name: 'query_time',
    type: 'datetime',
    comment: '查询时间',
  })
  @Index()
  queryTime?: Date

  @Column({
    name: 'query_duration',
    type: 'int',
    comment: '查询耗时(毫秒)',
  })
  queryDuration?: number

  @Column({
    name: 'result_size',
    type: 'int',
    comment: '结果数据量',
    nullable: true,
  })
  resultSize?: number

  @Column({
    name: 'is_success',
    type: 'tinyint',
    comment: '是否成功: 0-失败, 1-成功',
    default: 1,
  })
  isSuccess?: number

  @Column({
    name: 'error_msg',
    type: 'text',
    comment: '错误信息',
    nullable: true,
  })
  errorMsg?: string

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