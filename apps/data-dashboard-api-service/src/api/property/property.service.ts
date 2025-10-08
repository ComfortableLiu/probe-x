import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import {
  IQueryCommonPropertyListRes,
  IQueryPropertyListRes,
  MetaPropertyBusinessType,
} from "@probe-x/shared-types/src"
import { MetaPropertyEntity } from "@entity/MetaProperty.entity"
import { PaginationDto, PropertyFilterDto } from "./type"

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(MetaPropertyEntity)
    private propertyRepository: Repository<MetaPropertyEntity>,
  ) {
  }

  async getPropertyListWithPagination(
    filter: PropertyFilterDto,
    pagination: PaginationDto,
  ): Promise<IQueryPropertyListRes> {
    const { page, pageSize } = pagination
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

    // 添加分页
    queryBuilder.skip((page - 1) * pageSize)
      .take(pageSize)

    const [data, total] = await queryBuilder.getManyAndCount()

    return {
      data: data.map(property => ({
        propertyName: property.propertyName,
        propertyType: property.propertyType,
        type: property.type,
        createTime: property.createTime,
        updateTime: property.updateTime,
        status: property.status,
        createUserId: property.createUser?.userId,
        createUsername: property.createUser?.username,
        createNickname: property.createUser?.nickname,
        updateUserId: property.updateUser?.userId,
        updateUsername: property.updateUser?.username,
        updateNickname: property.updateUser?.nickname,
      })),
      total,
      page,
      pageSize,
    }
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
}
