import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type {
  ICreateBusinessSiteReq,
  ICreateBusinessSiteRes,
  ICreateSpmNodeReq,
  ICreateSpmNodeRes,
  IQueryBusinessListRes,
  IQueryTrackingSpmListRes,
  IUpdateBusinessSiteReq,
  IUpdateBusinessSiteRes,
  IUpdateSpmNodeReq,
  IUpdateSpmNodeRes,
  IUser,
} from "@probe-x/shared-types/src"
import { TrackingNodeLevel, TrackingNodeStatus, TrackingNodeType } from "@probe-x/shared-types/src"
import { BusinessException } from "@probe-x/shared-utils/src/lib/backend-common"
import { TrackingNodeEntity } from "@probe-x/shared-utils/src/lib/backend-common/entity/TrackingNode.entity"
import { UserEntity } from "@probe-x/shared-utils/src/lib/backend-common/entity/User.entity"
import { System } from "@probe-x/shared-utils/src/lib/backend-common/entity/System.entity"

@Injectable()
export class TrackingNodeService {
  constructor(
    @InjectRepository(TrackingNodeEntity)
    private trackingNodeRepository: Repository<TrackingNodeEntity>,
    @InjectRepository(System)
    private systemRepository: Repository<System>,
  ) {
  }

  /**
   * 生成随机字符串，包含大小写字母与数字
   * @param length
   * @private
   */
  private generateRandomString(length: number = 8): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return result
  }

  async getTrackingNodeList(
    page: number = 1,
    pageSize: number = 20,
    parentCode: string | null,
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
        'children.parentCode = trackingNode.code AND children.type = :type',
        { type },
      )
      // 修正用户表连接方式：使用实体类名的字符串形式
      .leftJoin(
        UserEntity,  // 这里使用实体类名的字符串形式
        'createUser',
        'createUser.userId = trackingNode.createUserId',
      )
      .leftJoin(
        UserEntity,  // 这里使用实体类名的字符串形式
        'updateUser',
        'updateUser.userId = trackingNode.updateUserId',
      )

    if (parentCode) {
      query.where('trackingNode.parentCode = :parentCode', { parentCode })
      countWhere['parentCode'] = parentCode
    } else {
      // parentCode为空时，查询第一级节点（level=1）
      query.where('trackingNode.parentCode IS NULL')
      query.andWhere('trackingNode.level = :level', { level: TrackingNodeLevel.LEVEL1 })
      countWhere['parentCode'] = null
      countWhere['level'] = TrackingNodeLevel.LEVEL1
    }
    if (type) {
      query.andWhere('trackingNode.type = :type', { type })
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
    query.groupBy('trackingNode.code')
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
        'createUser.username as createUsername',
        'createUser.nickname as createNickname',
        'trackingNode.updateTime as updateTime',
        'trackingNode.updateUserId as updateUserId',
        'updateUser.username as updateUsername',
        'updateUser.nickname as updateNickname',
        'COUNT(children.code) AS childrenCount', // 统计子节点数量
      ])
      // 按编码排序
      .orderBy('trackingNode.updateTime', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
    try {
      const result = await query.getRawMany()

      return {
        total,
        page,
        pageSize,
        data: result.map((item) => ({
          code: item.code,
          type: item.type,
          level: Number(item.level),
          name: item.name,
          description: item.description,
          parentCode: item.parentCode,
          status: Number(item.status),
          createTime: item.createTime,
          createUserId: item.createUserId,
          createUsername: item.createUsername,
          createNickname: item.createNickname,
          updateTime: item.updateTime,
          childrenCount: Number(item.childrenCount),
          updateNickname: item.updateNickname,
          updateUserId: item.updateUserId,
          updateUsername: item.updateUsername,
        })),
      }
    } catch (e) {
      console.error(e)
      throw new BusinessException('查询失败')
    }
  }

  async getBusinessList(): Promise<IQueryBusinessListRes> {
    const result = await this.trackingNodeRepository.createQueryBuilder('trackingNode')
      .leftJoinAndSelect('trackingNode.createUser', 'createUser')
      .leftJoinAndSelect('trackingNode.updateUser', 'updateUser')
      .where({ level: TrackingNodeLevel.LEVEL1, type: TrackingNodeType.SPM })
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

  async createBusiness({ name, description }: ICreateBusinessSiteReq, user: IUser): Promise<ICreateBusinessSiteRes> {
    const code = this.generateRandomString()
    const businessSiteInfo = await this.trackingNodeRepository.save({
      code,
      name,
      description,
      type: TrackingNodeType.SPM,
      level: TrackingNodeLevel.LEVEL1,
      status: TrackingNodeStatus.VALID,
      createUserId: user.userId,
      updateUserId: user.userId,
    })

    // 同步创建 System 记录（强绑定：SPM 第一层节点 <-> System）
    const system = this.systemRepository.create({
      systemKey: code,
      systemName: name,
      description,
      trackingNodeCode: code,
      isEnable: 1,
    })
    await this.systemRepository.save(system)

    return {
      type: businessSiteInfo.type,
      code: businessSiteInfo.code,
      name: businessSiteInfo.name,
      description: businessSiteInfo.description,
      level: businessSiteInfo.level,
      status: businessSiteInfo.status,
      createTime: businessSiteInfo.createTime,
      updateTime: businessSiteInfo.updateTime,
      createUserId: businessSiteInfo.createUserId,
      updateUserId: businessSiteInfo.updateUserId,
      createUsername: user.username,
      createNickname: user.nickname,
      updateUsername: user.username,
      updateNickname: user.nickname,
    }
  }

  async updateBusiness(req: IUpdateBusinessSiteReq, user: IUser): Promise<IUpdateBusinessSiteRes> {
    const {
      code,
      name,
      description,
    } = req
    const businessSiteInfo = await this.trackingNodeRepository.save({
      code,
      name,
      description,
      updateUserId: user.userId,
      updateTime: new Date(),
    })

    // 同步更新 System（保持名称和描述一致）
    const system = await this.systemRepository.findOne({ where: { trackingNodeCode: code } })
    if (system) {
      system.systemName = name
      system.description = description
      await this.systemRepository.save(system)
    }
    return {
      type: businessSiteInfo.type,
      code: businessSiteInfo.code,
      name: businessSiteInfo.name,
      description: businessSiteInfo.description,
      level: businessSiteInfo.level,
      status: businessSiteInfo.status,
      createTime: businessSiteInfo.createTime,
      updateTime: businessSiteInfo.updateTime,
      createUserId: businessSiteInfo.createUserId,
      updateUserId: businessSiteInfo.updateUserId,
      createUsername: user.username,
      createNickname: user.nickname,
      updateUsername: user.username,
      updateNickname: user.nickname,
    }
  }

  async createSpmNode(req: ICreateSpmNodeReq, user: IUser): Promise<ICreateSpmNodeRes> {
    const {
      name,
      description,
      parentCode,
      level,
    } = req
    const data = {
      code: this.generateRandomString(),
      name,
      description,
      parentCode,
      level,
      type: TrackingNodeType.SPM,
      createUserId: user.userId,
      updateUserId: user.userId,
    }
    const businessSiteInfo = await this.trackingNodeRepository.save(data)
    return {
      type: businessSiteInfo.type,
      code: businessSiteInfo.code,
      name: businessSiteInfo.name,
      description: businessSiteInfo.description,
      level: businessSiteInfo.level,
      status: businessSiteInfo.status,
      createTime: businessSiteInfo.createTime,
      updateTime: businessSiteInfo.updateTime,
      createUserId: businessSiteInfo.createUserId,
      updateUserId: businessSiteInfo.updateUserId,
      createUsername: user.username,
      createNickname: user.nickname,
      updateUsername: user.username,
      updateNickname: user.nickname,
    }
  }

  async updateSpmNode(req: IUpdateSpmNodeReq, user: IUser): Promise<IUpdateSpmNodeRes> {
    return this.updateBusiness(req, user)
  }

  async getScmBusinessList(): Promise<IQueryBusinessListRes> {
    const result = await this.trackingNodeRepository.createQueryBuilder('trackingNode')
      .leftJoinAndSelect('trackingNode.createUser', 'createUser')
      .leftJoinAndSelect('trackingNode.updateUser', 'updateUser')
      .where({ level: TrackingNodeLevel.LEVEL1, type: TrackingNodeType.SCM })
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

  async createScmBusiness({ name, description }: ICreateBusinessSiteReq, user: IUser): Promise<ICreateBusinessSiteRes> {
    const code = this.generateRandomString()
    const businessSiteInfo = await this.trackingNodeRepository.save({
      code,
      name,
      description,
      type: TrackingNodeType.SCM,
      level: TrackingNodeLevel.LEVEL1,
      status: TrackingNodeStatus.VALID,
      createUserId: user.userId,
      updateUserId: user.userId,
    })

    return {
      type: businessSiteInfo.type,
      code: businessSiteInfo.code,
      name: businessSiteInfo.name,
      description: businessSiteInfo.description,
      level: businessSiteInfo.level,
      status: businessSiteInfo.status,
      createTime: businessSiteInfo.createTime,
      updateTime: businessSiteInfo.updateTime,
      createUserId: businessSiteInfo.createUserId,
      updateUserId: businessSiteInfo.updateUserId,
      createUsername: user.username,
      createNickname: user.nickname,
      updateUsername: user.username,
      updateNickname: user.nickname,
    }
  }

  async updateScmBusiness(req: IUpdateBusinessSiteReq, user: IUser): Promise<IUpdateBusinessSiteRes> {
    const {
      code,
      name,
      description,
    } = req
    const businessSiteInfo = await this.trackingNodeRepository.save({
      code,
      name,
      description,
      updateUserId: user.userId,
      updateTime: new Date(),
    })
    return {
      type: businessSiteInfo.type,
      code: businessSiteInfo.code,
      name: businessSiteInfo.name,
      description: businessSiteInfo.description,
      level: businessSiteInfo.level,
      status: businessSiteInfo.status,
      createTime: businessSiteInfo.createTime,
      updateTime: businessSiteInfo.updateTime,
      createUserId: businessSiteInfo.createUserId,
      updateUserId: businessSiteInfo.updateUserId,
      createUsername: user.username,
      createNickname: user.nickname,
      updateUsername: user.username,
      updateNickname: user.nickname,
    }
  }

  async createScmNode(req: ICreateSpmNodeReq, user: IUser): Promise<ICreateSpmNodeRes> {
    const {
      name,
      description,
      parentCode,
      level,
    } = req
    const data = {
      code: this.generateRandomString(),
      name,
      description,
      parentCode,
      level,
      type: TrackingNodeType.SCM,
      createUserId: user.userId,
      updateUserId: user.userId,
    }
    const businessSiteInfo = await this.trackingNodeRepository.save(data)
    return {
      type: businessSiteInfo.type,
      code: businessSiteInfo.code,
      name: businessSiteInfo.name,
      description: businessSiteInfo.description,
      level: businessSiteInfo.level,
      status: businessSiteInfo.status,
      createTime: businessSiteInfo.createTime,
      updateTime: businessSiteInfo.updateTime,
      createUserId: businessSiteInfo.createUserId,
      updateUserId: businessSiteInfo.updateUserId,
      createUsername: user.username,
      createNickname: user.nickname,
      updateUsername: user.username,
      updateNickname: user.nickname,
    }
  }

  async updateScmNode(req: IUpdateSpmNodeReq, user: IUser): Promise<IUpdateSpmNodeRes> {
    return this.updateScmBusiness(req, user)
  }
}
