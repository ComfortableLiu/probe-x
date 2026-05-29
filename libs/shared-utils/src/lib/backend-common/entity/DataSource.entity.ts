import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * 数据源配置表实体
 * 存储系统中各种数据源的连接配置信息
 */
@Entity('data_source', {
  comment: '数据源配置表：存储系统中各种数据源的连接配置信息',
})
export class DataSourceEntity {
  /** 数据源唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id?: number

  /** 数据源名称（唯一） */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'datasource_name',
    unique: true,
    comment: '数据源名称（唯一）',
  })
  datasourceName?: string

  /** 数据源类型（clickhouse/mysql/postgresql） */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'datasource_type',
    comment: '数据源类型（clickhouse/mysql/postgresql）',
  })
  datasourceType?: string

  /** 连接地址 */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'host',
    comment: '连接地址',
  })
  host?: string

  /** 端口 */
  @Column({
    type: 'int',
    name: 'port',
    comment: '端口',
  })
  port?: number

  /** 数据库名 */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'database_name',
    comment: '数据库名',
  })
  database?: string

  /** 用户名 */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'username',
    nullable: true,
    comment: '用户名',
  })
  username?: string

  /** 密码（加密存储） */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'password',
    nullable: true,
    comment: '密码（加密存储）',
  })
  password?: string

  /** 连接状态（normal/error/unchecked） */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'status',
    default: 'unchecked',
    comment: '连接状态（normal/error/unchecked）',
  })
  status?: string

  /** 最后检测时间 */
  @Column({
    type: 'datetime',
    name: 'last_check_time',
    nullable: true,
    comment: '最后检测时间',
  })
  lastCheckTime?: Date

  /** 描述 */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'description',
    nullable: true,
    comment: '描述',
  })
  description?: string

  /** 创建时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '创建时间（自动填充）',
  })
  createdAt?: Date

  /** 更新时间（自动更新） */
  @UpdateDateColumn({
    type: 'datetime',
    name: 'updated_at',
    comment: '更新时间（自动更新）',
  })
  updatedAt?: Date
}
