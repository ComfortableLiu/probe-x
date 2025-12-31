import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * 数据分析导出记录实体
 * 用于记录数据分析结果的导出情况
 */
@Entity('data_analysis_export_log')
export class DataAnalysisExportLogEntity {
  @PrimaryGeneratedColumn({
    name: 'id',
    comment: '主键ID',
  })
  id?: number

  @Column({
    name: 'export_id',
    type: 'varchar',
    length: 64,
    comment: '导出记录唯一标识',
    unique: true,
  })
  @Index()
  exportId?: string

  @Column({
    name: 'user_id',
    type: 'int',
    comment: '导出用户ID',
  })
  userId?: number

  @Column({
    name: 'user_name',
    type: 'varchar',
    length: 100,
    comment: '导出用户名',
  })
  userName?: string

  @Column({
    name: 'export_type',
    type: 'varchar',
    length: 50,
    comment: '导出类型: csv, excel, pdf, json等',
  })
  exportType?: string

  @Column({
    name: 'export_content',
    type: 'text',
    comment: '导出内容描述',
    nullable: true,
  })
  exportContent?: string

  @Column({
    name: 'export_params',
    type: 'json',
    comment: '导出参数',
    nullable: true,
  })
  exportParams?: any

  @Column({
    name: 'file_path',
    type: 'varchar',
    length: 500,
    comment: '导出文件路径',
    nullable: true,
  })
  filePath?: string

  @Column({
    name: 'file_size',
    type: 'bigint',
    comment: '文件大小(字节)',
    nullable: true,
  })
  fileSize?: number

  @Column({
    name: 'status',
    type: 'tinyint',
    comment: '导出状态: 0-处理中, 1-已完成, 2-失败',
    default: 0,
  })
  status?: number

  @Column({
    name: 'start_time',
    type: 'datetime',
    comment: '开始时间',
    nullable: true,
  })
  startTime?: Date

  @Column({
    name: 'end_time',
    type: 'datetime',
    comment: '结束时间',
    nullable: true,
  })
  endTime?: Date

  @Column({
    name: 'duration',
    type: 'int',
    comment: '导出耗时(秒)',
    nullable: true,
  })
  duration?: number

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