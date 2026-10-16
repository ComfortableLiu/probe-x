import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ComputeNodeEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/ComputeNode.entity'
import { reportedNodePort } from './node-endpoint'
import { NodeStatus, NodeType } from '@probe-x/shared-types/src'

interface NodeRegistration {
  nodeId: string
  nodeName: string
  nodeAddress?: string
  nodePort?: number
  status: NodeStatus
}

interface RegistrationWrite {
  pending?: NodeRegistration
  promise: Promise<void>
}

/** 自动注册节点的持久化记录，用于离线拓扑展示。 */
@Injectable()
export class ComputeNodeService {
  /** 同一节点至多一个写入和一个最新待写快照，避免监听后补报与首次注册竞态。 */
  private readonly registrationWrites = new Map<string, RegistrationWrite>()

  constructor(
    @InjectRepository(ComputeNodeEntity)
    private nodeRepo: Repository<ComputeNodeEntity>,
  ) {}

  /**
   * 节点自动注册：按 nodeId 幂等 upsert，字段变化时才写库
   *
   * 节点拨出连上总服务后上报自身信息，总服务据此落库。
   */
  async upsertFromRegister(input: NodeRegistration): Promise<void> {
    if (!input.nodeId) return
    const existing = this.registrationWrites.get(input.nodeId)
    if (existing) {
      existing.pending = { ...input }
      return existing.promise
    }
    const write: RegistrationWrite = { pending: { ...input }, promise: Promise.resolve() }
    write.promise = Promise.resolve().then(() => this.flushRegistrations(input.nodeId, write))
    this.registrationWrites.set(input.nodeId, write)
    return write.promise
  }

  private async flushRegistrations(nodeId: string, write: RegistrationWrite): Promise<void> {
    let failure: unknown
    let failed = false
    while (write.pending) {
      const input = write.pending
      write.pending = undefined
      try {
        await this.saveRegistration(input)
        failure = undefined
        failed = false
      } catch (error: unknown) {
        failure = error
        failed = true
      }
    }
    this.registrationWrites.delete(nodeId)
    if (failed) throw failure
  }

  private async saveRegistration(input: NodeRegistration): Promise<void> {
    const entity = await this.nodeRepo.findOne({ where: { nodeId: input.nodeId } })
    const detectedPort = reportedNodePort(input.nodePort)
    if (!entity) {
      await this.nodeRepo.save(
        this.nodeRepo.create({
          nodeId: input.nodeId,
          nodeName: input.nodeName || input.nodeId,
          nodeAddress: input.nodeAddress || '',
          nodePort: detectedPort ?? 0,
          nodeType: 'grpc',
          status: input.status,
          weight: 100,
          description: '由计算节点自动注册',
        }),
      )
      return
    }

    const nextName = input.nodeName || entity.nodeName
    const nextAddress = input.nodeAddress || entity.nodeAddress
    const nextPort = detectedPort ?? entity.nodePort ?? 0
    if (
      entity.status === input.status &&
      entity.nodeName === nextName &&
      entity.nodeAddress === nextAddress &&
      entity.nodePort === nextPort
    ) {
      return
    }

    entity.status = input.status
    entity.nodeName = nextName!
    entity.nodeAddress = nextAddress!
    entity.nodePort = nextPort
    await this.nodeRepo.save(entity)
  }

  /**
   * 已绑定 nodeId 的节点（自动注册产生的记录）
   *
   * 拓扑图用它把「库里有、当前没连上」的节点也展示为离线，
   * 避免总服务重启或节点被强杀后页面上凭空少一个节点。
   */
  async listRegistered(): Promise<
    Array<{ nodeId: string; nodeName: string; nodeAddress: string; nodePort: number; nodeType: NodeType }>
    > {
    const list = await this.nodeRepo
      .createQueryBuilder('node')
      .where('node.node_id IS NOT NULL')
      .orderBy('node.created_at', 'ASC')
      .getMany()

    return list.map((item) => ({
      nodeId: item.nodeId!,
      nodeName: item.nodeName || item.nodeId!,
      nodeAddress: item.nodeAddress || '',
      nodePort: item.nodePort ?? 0,
      nodeType: (item.nodeType as NodeType) || 'grpc',
    }))
  }

  /** 断线/心跳超时回写运行状态，只更新已存在的记录（不隐式建行） */
  async syncStatus(nodeId: string, status: NodeStatus): Promise<void> {
    if (!nodeId) return
    await this.nodeRepo.update({ nodeId }, { status })
  }
}
