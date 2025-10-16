import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import type {
  ICreatePropertyReq,
  ICreatePropertyRes,
  IQueryCommonPropertyListRes,
  IQueryPropertyListRes,
} from "@probe-x/shared-types/src"
import { MetaPropertyBusinessType } from "@probe-x/shared-types/src"
import { MetaPropertyEntity } from "@entity/MetaProperty.entity"
import { PropertyFilterDto } from "./type"
import { ClickHouseService } from "@probe-x/shared-utils/src/lib/backend-common"

@Injectable()
export class PropertyService {
  constructor(
    private clickhouseService: ClickHouseService,
    @InjectRepository(MetaPropertyEntity)
    private propertyRepository: Repository<MetaPropertyEntity>,
  ) {
  }

  async getPropertyListWithPagination(
    filter: PropertyFilterDto,
  ): Promise<IQueryPropertyListRes> {
    const { propertyName, status, eventName, type } = filter

    // 使用 QueryBuilder 构建复杂查询
    const queryBuilder = this.propertyRepository.createQueryBuilder('property')
      .leftJoinAndSelect('property.createUser', 'createUser')
      .leftJoinAndSelect('property.updateUser', 'updateUser')

    // 添加类型过滤条件
    if (type) {
      queryBuilder.andWhere('property.type = :type', { type })
    }

    // 添加状态过滤条件
    if (status) {
      queryBuilder.andWhere('property.status = :status', { status })
    }

    // 添加属性名称模糊匹配条件
    if (propertyName) {
      queryBuilder.andWhere('property.propertyName LIKE :propertyName', { propertyName: `%${propertyName}%` })
    }

    // 根据事件名称筛选属性
    if (eventName) {
      queryBuilder.innerJoin('property.eventPropertyRelations', 'relation')
        .innerJoin('relation.metaEvent', 'event')
        .andWhere('event.eventName = :eventName', { eventName })
    }

    const data = await queryBuilder.getMany()

    return data.map(temp => ({
      propertyName: temp.propertyName,
      propertyType: temp.propertyType,
      type: temp.type,
      createTime: temp.createTime,
      updateTime: temp.updateTime,
      status: temp.status,
      createUserId: temp.createUser?.userId,
      createUsername: temp.createUser?.username,
      createNickname: temp.createUser?.nickname,
      updateUserId: temp.updateUser?.userId,
      updateUsername: temp.updateUser?.username,
      updateNickname: temp.updateUser?.nickname,
    }))
  }

  async getCommonProperties(): Promise<IQueryCommonPropertyListRes> {
    const list = await this.propertyRepository.find({
      where: {
        type: MetaPropertyBusinessType.COMMON,
      },
      relations: ['createUser', 'updateUser'],
    })
    return list.map(item => ({
      propertyName: item.propertyName,
      propertyType: item.propertyType,
    }))
  }

  async createProperty(data: ICreatePropertyReq): Promise<ICreatePropertyRes> {
    // 先创建ClickHouse的列
    // TODO 需要先处理一下同步两边的类型
    await this.clickhouseService.executeDDL(`
      ALTER TABLE event ADD COLUMN IF NOT EXISTS ${data.propertyName} ${data.propertyType}
    `)
    // 保存到自定义数据库中
    const property = await this.propertyRepository.save(data)
    return {
      type: property.type,
      propertyName: property.propertyName,
      propertyType: property.propertyType,
      status: property.status,
      createTime: property.createTime,
      updateTime: property.updateTime,
      createUserId: property.createUser?.userId,
      createUsername: property.createUser?.username,
      createNickname: property.createUser?.nickname,
      updateUserId: property.updateUser?.userId,
      updateUsername: property.updateUser?.username,
      updateNickname: property.updateUser?.nickname,
    }
  }
}
