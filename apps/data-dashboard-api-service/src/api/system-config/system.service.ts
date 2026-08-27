import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { System } from '@probe-x/shared-utils/src/lib/backend-common/entity/System.entity'
import { TrackingNodeEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/TrackingNode.entity'
import {
  ICreateSystemReq,
  ICreateSystemRes,
  IDeleteSystemReq,
  IQuerySystemListReq,
  IQuerySystemListRes,
  ISystemListItem,
  IUpdateSystemReq,
  IUpdateSystemRes,
} from '@probe-x/shared-types/src'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common/entity/response.entity'

@Injectable()
export class SystemConfigSystemService {
  constructor(
    @InjectRepository(System)
    private systemRepo: Repository<System>,
    @InjectRepository(TrackingNodeEntity)
    private trackingNodeRepo: Repository<TrackingNodeEntity>,
  ) {}

  /**
   * 获取系统列表（分页）
   */
  async getSystemList(params: IQuerySystemListReq): Promise<IQuerySystemListRes> {
    const { systemKey, systemName, isEnable, page = 1, pageSize = 20 } = {
      page: 1,
      pageSize: 20,
      ...params,
    }

    const queryBuilder = this.systemRepo
      .createQueryBuilder('system')
      .leftJoinAndSelect('system.trackingNode', 'trackingNode')

    // 添加筛选条件
    if (systemKey) {
      queryBuilder.andWhere('system.systemKey LIKE :systemKey', {
        systemKey: `%${systemKey}%`,
      })
    }
    if (systemName) {
      queryBuilder.andWhere('system.systemName LIKE :systemName', {
        systemName: `%${systemName}%`,
      })
    }
    if (isEnable !== undefined) {
      queryBuilder.andWhere('system.isEnable = :isEnable', { isEnable: isEnable ? 1 : 0 })
    }

    // 获取总数
    const total = await queryBuilder.getCount()

    // 分页查询
    const systems = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('system.createdAt', 'DESC')
      .getMany()

    // 格式化返回数据
    const data: ISystemListItem[] = systems.map((system) => ({
      id: system.id!,
      systemKey: system.systemKey!,
      systemName: system.systemName!,
      description: system.description,
      trackingNodeCode: system.trackingNodeCode,
      trackingNodeName: system.trackingNode?.name,
      isEnable: system.isEnable === 1,
      createdAt: system.createdAt,
      updatedAt: system.updatedAt,
    }))

    return {
      data,
      total,
      page,
      pageSize,
    }
  }

  /**
   * 创建系统
   */
  async createSystem(_req: ICreateSystemReq): Promise<ResponseData<ICreateSystemRes>> {
    // 系统由 SPM 第一层节点自动创建，不允许在此手动创建
    return ResponseData.error('系统由SPM业务线/站点自动创建，请在SPM管理中新增业务线')
  }

  /**
   * 更新系统
   */
  async updateSystem(req: IUpdateSystemReq): Promise<ResponseData<IUpdateSystemRes>> {
    const { id, isEnable } = req

    const system = await this.systemRepo.findOne({
      where: { id },
    })

    if (!system) {
      throw new Error(`系统 ID "${id}" 不存在`)
    }

    // 强绑定：systemName / description / trackingNodeCode 由 SPM 节点驱动，不允许在此修改
    // 使用 QueryBuilder 直接更新，确保更新成功
    if (isEnable !== undefined) {
      const enableValue = isEnable ? 1 : 0

      // 使用 QueryBuilder 更新，并检查影响的行数
      const updateResult = await this.systemRepo
        .createQueryBuilder()
        .update(System)
        .set({ isEnable: enableValue })
        .where('id = :id', { id })
        .execute()

      if (updateResult.affected === 0) {
        throw new Error(`更新系统失败：未找到 ID 为 ${id} 的系统`)
      }
    }

    // 重新查询确保获取最新数据
    const freshSystem = await this.systemRepo.findOne({
      where: { id },
      relations: ['trackingNode'],
    })

    if (!freshSystem) {
      throw new Error(`更新后无法找到系统 ID "${id}"`)
    }

    return {
      code: 200,
      message: '更新成功',
      data: {
        id: freshSystem.id!,
        systemKey: freshSystem.systemKey!,
        systemName: freshSystem.systemName!,
        description: freshSystem.description,
        trackingNodeCode: freshSystem.trackingNodeCode,
        isEnable: freshSystem.isEnable === 1,
      },
    }
  }

  /**
   * 删除系统
   */
  async deleteSystem(req: IDeleteSystemReq): Promise<ResponseData<null>> {
    // 系统删除由SPM业务线删除时同步处理，此处不允许单独删除
    return ResponseData.error('系统删除由SPM业务线删除时自动处理，请在SPM管理中删除业务线')
  }

  /**
   * 获取系统选项列表（用于下拉选择）
   */
  async getSystemOptions(): Promise<Array<{ id: number; systemKey: string; systemName: string }>> {
    const systems = await this.systemRepo.find({
      where: { isEnable: 1 },
      order: { createdAt: 'ASC' },
    })

    return systems.map((system) => ({
      id: system.id!,
      systemKey: system.systemKey!,
      systemName: system.systemName!,
    }))
  }
}
