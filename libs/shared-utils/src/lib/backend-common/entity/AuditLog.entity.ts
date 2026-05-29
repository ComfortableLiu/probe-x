import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 审计日志表实体
 * 记录系统中所有 API 写操作的审计日志
 */
@Entity('audit_log', {
  comment: '审计日志表：记录系统中所有 API 写操作的审计日志',
})
export class AuditLogEntity {
  /** 日志唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id?: number

  /** 操作用户ID */
  @Column({
    type: 'bigint',
    name: 'user_id',
    nullable: true,
    comment: '操作用户ID',
  })
  @Index()
  userId?: number

  /** 操作用户名 */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'username',
    comment: '操作用户名',
  })
  @Index()
  username?: string

  /** 操作类型（从路由解析，如 create/update/delete） */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'action',
    comment: '操作类型（如 create/update/delete）',
  })
  @Index()
  action?: string

  /** 请求方法 */
  @Column({
    type: 'varchar',
    length: 10,
    name: 'method',
    comment: '请求方法（POST/PUT/DELETE）',
  })
  method?: string

  /** 请求路径 */
  @Column({
    type: 'varchar',
    length: 500,
    name: 'path',
    comment: '请求路径',
  })
  path?: string

  /** 请求体摘要 */
  @Column({
    type: 'text',
    name: 'request_body',
    nullable: true,
    comment: '请求体摘要（JSON格式，敏感字段脱敏）',
  })
  requestBody?: string

  /** 响应状态码 */
  @Column({
    type: 'int',
    name: 'response_status',
    nullable: true,
    comment: '响应状态码',
  })
  responseStatus?: number

  /** IP地址 */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'ip',
    nullable: true,
    comment: 'IP地址',
  })
  ip?: string

  /** User-Agent */
  @Column({
    type: 'varchar',
    length: 500,
    name: 'user_agent',
    nullable: true,
    comment: 'User-Agent',
  })
  userAgent?: string

  /** 操作时间（自动填充） */
  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    comment: '操作时间（自动填充）',
  })
  @Index()
  createdAt?: Date
}
