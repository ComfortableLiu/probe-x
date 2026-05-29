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
}
