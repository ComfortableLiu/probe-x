import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ComputeNodeEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/ComputeNode.entity'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common/entity/response.entity'
import {
  IComputeNodeListItem,
  ICreateComputeNodeReq,
  ICreateComputeNodeRes,
  IQueryComputeNodeListReq,
  IQueryComputeNodeListRes,
  IUpdateComputeNodeReq,
  IUpdateComputeNodeRes,
  NodeStatus,
  NodeType,
} from '@probe-x/shared-types/src'

@Injectable()
export class ComputeNodeService {
  constructor(
    @InjectRepository(ComputeNodeEntity)
    private nodeRepo: Repository<ComputeNodeEntity>,
  ) {}

  async getList(params: IQueryComputeNodeListReq): Promise<IQueryComputeNodeListRes> {
    const { nodeName, status, page = 1, pageSize = 20 } = {
      page: 1,
      pageSize: 20,
      ...params,
    }

    const qb = this.nodeRepo.createQueryBuilder('node')

    if (nodeName) {
      qb.andWhere('node.node_name LIKE :name', { name: `%${nodeName}%` })
    }
    if (status) {
      qb.andWhere('node.status = :status', { status })
    }

    const total = await qb.getCount()
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('node.created_at', 'DESC')
      .getMany()

    const data: IComputeNodeListItem[] = list.map(item => ({
      id: Number(item.id),
      nodeId: item.nodeId,
      nodeName: item.nodeName!,
      nodeAddress: item.nodeAddress!,
      nodePort: item.nodePort!,
      nodeType: (item.nodeType as any) || 'grpc',
      status: (item.status as any) || 'stopped',
      weight: item.weight || 100,
      description: item.description,
      createTime: item.createdAt?.toISOString(),
      updateTime: item.updatedAt?.toISOString(),
    }))

    return { data, total, page, pageSize }
  }

  async create(data: ICreateComputeNodeReq): Promise<ResponseData<ICreateComputeNodeRes>> {
    const entity = this.nodeRepo.create({
      nodeName: data.nodeName,
      nodeAddress: data.nodeAddress,
      nodePort: data.nodePort,
      nodeType: data.nodeType || 'grpc',
      weight: data.weight ?? 100,
      description: data.description,
      status: 'stopped',
    })

    const saved = await this.nodeRepo.save(entity)
    return ResponseData.success({ id: Number(saved.id), nodeName: saved.nodeName! })
  }

  async update(data: IUpdateComputeNodeReq): Promise<ResponseData<IUpdateComputeNodeRes>> {
    const entity = await this.nodeRepo.findOne({ where: { id: data.id } })
    if (!entity) {
      return ResponseData.error('计算节点不存在')
    }

    if (data.nodeName) entity.nodeName = data.nodeName
    if (data.nodeAddress) entity.nodeAddress = data.nodeAddress
    if (data.nodePort) entity.nodePort = data.nodePort
    if (data.nodeType) entity.nodeType = data.nodeType
    if (data.status) entity.status = data.status
    if (data.weight !== undefined) entity.weight = data.weight
    if (data.description !== undefined) entity.description = data.description

    const saved = await this.nodeRepo.save(entity)
    return ResponseData.success({ id: Number(saved.id), nodeName: saved.nodeName! })
  }

  async delete(id: number): Promise<ResponseData<null>> {
    const entity = await this.nodeRepo.findOne({ where: { id } })
    if (!entity) {
      return ResponseData.error('计算节点不存在')
    }
    await this.nodeRepo.remove(entity)
    return ResponseData.success(null)
  }

  /**
   * 节点自动注册：按 nodeId 幂等 upsert，字段变化时才写库
   *
   * 节点拨出连上总服务后上报自身信息，总服务据此落库，
   * 免去人工在「计算节点配置」里登记地址端口。
   */
  async upsertFromRegister(input: {
    nodeId: string
    nodeName: string
    nodeAddress?: string
    status: NodeStatus
  }): Promise<void> {
    if (!input.nodeId) return

    const entity = await this.nodeRepo.findOne({ where: { nodeId: input.nodeId } })
    if (!entity) {
      await this.nodeRepo.save(
        this.nodeRepo.create({
          nodeId: input.nodeId,
          nodeName: input.nodeName || input.nodeId,
          nodeAddress: input.nodeAddress || '',
          nodePort: 0,
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
    if (
      entity.status === input.status &&
      entity.nodeName === nextName &&
      entity.nodeAddress === nextAddress
    ) {
      return
    }

    entity.status = input.status
    entity.nodeName = nextName!
    entity.nodeAddress = nextAddress!
    await this.nodeRepo.save(entity)
  }

  /**
   * 已绑定 nodeId 的节点（自动注册产生的记录）
   *
   * 拓扑图用它把「库里有、当前没连上」的节点也展示为离线，
   * 避免总服务重启或节点被强杀后页面上凭空少一个节点。
   */
  async listRegistered(): Promise<
    Array<{ nodeId: string; nodeName: string; nodeAddress: string; nodeType: NodeType }>
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
      nodeType: (item.nodeType as NodeType) || 'grpc',
    }))
  }

  /** 断线/心跳超时回写运行状态，只更新已存在的记录（不隐式建行） */
  async syncStatus(nodeId: string, status: NodeStatus): Promise<void> {
    if (!nodeId) return
    await this.nodeRepo.update({ nodeId }, { status })
  }
}
