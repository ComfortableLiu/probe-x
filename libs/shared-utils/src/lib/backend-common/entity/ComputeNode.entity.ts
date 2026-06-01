import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * 计算节点配置表实体
 * 存储系统中计算节点的注册配置信息
 */
@Entity('compute_node', {
  comment: '计算节点配置表：存储系统中计算节点的注册配置信息',
})
export class ComputeNodeEntity {
  /** 节点唯一ID（自增） */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  @Index()
  id?: number

  /** 节点名称 */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'node_name',
    comment: '节点名称',
  })
  nodeName?: string

  /** 节点地址 */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'node_address',
    comment: '节点地址',
  })
  nodeAddress?: string

  /** 节点端口 */
  @Column({
    type: 'int',
    name: 'node_port',
    comment: '节点端口',
  })
  nodePort?: number

  /** 节点类型（grpc） */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'node_type',
    default: 'grpc',
    comment: '节点类型（grpc）',
  })
  nodeType?: string

  /** 节点状态（running/stopped/error） */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'status',
    default: 'stopped',
    comment: '节点状态（running/stopped/error）',
  })
  status?: string

  /** 权重（用于负载均衡，默认100） */
  @Column({
    type: 'int',
    name: 'weight',
    default: 100,
    comment: '权重（用于负载均衡，默认100）',
  })
  weight?: number

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
