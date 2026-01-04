import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * 数据分析任务日志实体
 * 用于记录数据分析任务的执行情况
 */
@Entity('data_analysis_task_log')
export class DataAnalysisTaskLogEntity {
  @PrimaryGeneratedColumn({
    name: 'id',
    comment: '主键ID',
  })
  id?: number

  @Column({
    name: 'task_id',
    type: 'varchar',
    length: 64,
    comment: '任务唯一标识',
    unique: true,
  })
  @Index()
  taskId?: string

  @Column({
    name: 'task_name',
    type: 'varchar',
    length: 255,
    comment: '任务名称',
  })
  taskName?: string

  @Column({
    name: 'initiator_id',
    type: 'int',
    comment: '发起任务用户ID',
  })
  initiatorId?: number

  @Column({
    name: 'initiator_name',
    type: 'varchar',
    length: 100,
    comment: '发起任务用户名',
  })
  initiatorName?: string

  @Column({
    name: 'query_content',
    type: 'text',
    comment: '查询内容或SQL语句',
    nullable: true,
  })
  queryContent?: string

  @Column({
    name: 'status',
    type: 'tinyint',
    comment: '任务状态: 0-排队中, 1-计算中, 2-已完成, 3-已终止',
    default: 0,
  })
  status?: number

  @Column({
    name: 'start_time',
    type: 'datetime',
    comment: '任务开始时间',
    nullable: true,
  })
  startTime?: Date

  @Column({
    name: 'end_time',
    type: 'datetime',
    comment: '任务结束时间',
    nullable: true,
  })
  endTime?: Date

  @Column({
    name: 'duration',
    type: 'int',
    comment: '任务执行耗时(秒)',
    nullable: true,
  })
  duration?: number

  @Column({
    name: 'result_size',
    type: 'int',
    comment: '结果数据量',
    nullable: true,
  })
  resultSize?: number

  @Column({
    name: 'result_path',
    type: 'varchar',
    length: 500,
    comment: '结果存储路径',
    nullable: true,
  })
  resultPath?: string

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