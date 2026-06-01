import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * 看板实体
 * 用于存储数据分析功能的看板配置
 */
@Entity('dashboard', {
  comment: '看板表：存储数据分析功能的看板配置，包括个人看板和公共看板',
})
export class DashboardEntity {
  @PrimaryGeneratedColumn({
    name: 'id',
    comment: '主键ID',
  })
  @Index()
  id?: number

  @Column({
    name: 'name',
    type: 'varchar',
    length: 200,
    comment: '看板名称',
  })
  name?: string

  @Column({
    name: 'type',
    type: 'enum',
    enum: ['personal', 'public'],
    default: 'personal',
    comment: '看板类型: personal-个人看板, public-公共看板',
  })
  @Index()
  type?: 'personal' | 'public'

  @Column({
    name: 'creator_id',
    type: 'int',
    comment: '创建者用户ID',
  })
  @Index()
  creatorId?: number

  @Column({
    name: 'creator_name',
    type: 'varchar',
    length: 100,
    comment: '创建者用户名',
  })
  creatorName?: string

  @Column({
    name: 'analysis_type',
    type: 'varchar',
    length: 50,
    comment: '数据分析类型: event-事件分析, funnel-漏斗分析, user-path-用户路径分析, attribution-归因分析',
  })
  @Index()
  analysisType?: string

  @Column({
    name: 'config',
    type: 'json',
    comment: '看板配置信息，包括表单参数、图表配置、表格配置等',
  })
  config?: any

  @Column({
    name: 'display_chart',
    type: 'boolean',
    default: true,
    comment: '是否展示图表',
  })
  displayChart?: boolean

  @Column({
    name: 'display_table',
    type: 'boolean',
    default: true,
    comment: '是否展示表格',
  })
  displayTable?: boolean

  @Column({
    name: 'permissions',
    type: 'json',
    nullable: true,
    comment: '权限配置（仅公共看板使用），存储可查看的角色列表',
  })
  permissions?: string[]

  @Column({
    name: 'is_deleted',
    type: 'boolean',
    default: false,
    comment: '是否已删除（软删除）',
  })
  @Index()
  isDeleted?: boolean

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
