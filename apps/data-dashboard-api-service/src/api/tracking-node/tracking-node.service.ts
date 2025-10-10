import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { TrackingNodeEntity } from "@entity/TrackingNode.entity"
import {
  IQueryBusinessListRes,
  IQueryTrackingSpmListRes,
  TrackingNodeStatus,
  TrackingNodeType,
} from "@probe-x/shared-types/src"
import { UserEntity } from "@entity/User.entity"

@Injectable()
export class TrackingNodeService {
  constructor(
    @InjectRepository(TrackingNodeEntity)
    private trackingNodeRepository: Repository<TrackingNodeEntity>,
  ) {
  }

  async getTrackingNodeList(
    page: number = 1,
    pageSize: number = 20,
    parentCode: string,
    type?: TrackingNodeType,
    name?: string,
    code?: string,
    status?: TrackingNodeStatus,
  ): Promise<IQueryTrackingSpmListRes> {
    const countWhere = {}
    const query = this.trackingNodeRepository
      .createQueryBuilder('trackingNode')
      // 左连接子节点表，用于统计数量
      .leftJoin(
        TrackingNodeEntity,
        'children',
        'children.parentCode = node.code AND children.type = :type',
        { type },
      )
      .leftJoin(
        UserEntity,
        'createUser',
        'user.id = trackingNode.createUserId',
      )
      .leftJoin(
        UserEntity,
        'updateUser',
        'user.id = trackingNode.updateUserId',
      )

    if (parentCode) {
      query.where('trackingNode.parentCode = :parentCode', { parentCode })
      countWhere['parentCode'] = parentCode
    }
    if (type) {
      query.where('trackingNode.type = :type', { type })
      countWhere['type'] = type
    }
    if (name) {
      query.andWhere('trackingNode.name ILIKE :name', { name: `%${name}%` })
      countWhere['name'] = name
    }
    if (code) {
      query.andWhere('trackingNode.code ILIKE :code', { code: `%${code}%` })
      countWhere['code'] = code
    }
    if (status) {
      query.andWhere('trackingNode.status = :status', { status })
      countWhere['status'] = status
    }

    // 查询总条数（用于计算分页信息）
    const total = await this.trackingNodeRepository.count({
      where: countWhere,
    })

    // 按主节点分组
    const result = await query.groupBy('trackingNode.id')
      // 选择主节点字段并统计子节点数量
      .select([
        'trackingNode.code as code',
        'trackingNode.type as type',
        'trackingNode.level as level',
        'trackingNode.name as name',
        'trackingNode.description as description',
        'trackingNode.parentCode as parentCode',
        'trackingNode.status as status',
        'trackingNode.createTime as createTime',
        'trackingNode.createUserId as createUserId',
        'createUser.name as createUsername as createUsername',
        'createUser.nickname as createNickname',
        'trackingNode.updateTime as updateTime',
        'trackingNode.updateUserId as updateUserId',
        'updateUser.name as updateUsername',
        'updateUser.nickname as updateNickname',
        'COUNT(children.id) AS childrenCount', // 统计子节点数量
      ])
      // 按编码排序
      .orderBy('trackingNode.updateTime', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getRawMany()

    return {
      total,
      page,
      pageSize,
      data: result.map((item) => ({
        code: item.code,
        type: item.type,
        level: item.level,
        name: item.name,
        description: item.description,
        parentCode: item.parentCode,
        status: item.status,
        createTime: item.createTime,
        createUserId: item.createUserId,
        createUsername: item.createUsername,
        createNickname: item.createNickname,
        updateTime: item.updateTime,
        childrenCount: item.childrenCount,
        updateNickname: item.updateNickname,
        updateUserId: item.updateUserId,
        updateUsername: item.updateUsername,
      })),
    }
  }

  async getBusinessList(): Promise<IQueryBusinessListRes> {
    const result = await this.trackingNodeRepository.createQueryBuilder('trackingNode')
      .leftJoinAndSelect('trackingNode.createUser', 'createUser')
      .leftJoinAndSelect('trackingNode.updateUser', 'updateUser')
      .orderBy('trackingNode.updateTime', 'DESC')
      .getMany()

    return result.map((item) => ({
      code: item.code,
      type: item.type,
      level: item.level,
      name: item.name,
      description: item.description,
      parentCode: item.parentCode,
      status: item.status,
      createTime: item.createTime,
      createUserId: item.createUserId,
      createUsername: item.createUser.username,
      createNickname: item.createUser.nickname,
      updateTime: item.updateTime,
      updateUserId: item.updateUserId,
      updateUsername: item.updateUser.username,
      updateNickname: item.updateUser.nickname,
    }))
  }
}
