import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import {
  IQueryCommonPropertyListRes,
  IQueryPropertyListRes,
  MetaPropertyBusinessType,
  MetaPropertyStatus,
} from "@probe-x/shared-types/src"
import { MetaPropertyEntity } from "@entity/MetaProperty.entity"
import { PropertyFilterDto } from "./type"
import { ClickHouseService } from "@probe-x/shared-utils/src/lib/backend-common"

@Injectable()
export class PropertyService {
  constructor(
    private clickHouseService: ClickHouseService,
    @InjectRepository(MetaPropertyEntity)
    private propertyRepository: Repository<MetaPropertyEntity>,
  ) {
  }

  async getPropertyListWithPagination(
    filter: PropertyFilterDto,
  ): Promise<IQueryPropertyListRes> {
    const { propertyName, status, eventName, type } = filter

    // 读一下ClickHouse表中的列信息
    const columns = await this.clickHouseService.query('DESCRIBE TABLE event')
    const list = columns.map((col: any) => ({
      name: col.name,
      type: col.type,
      default_type: col.default_type || 'none',
      default_expression: col.default_expression || 'none',
      comment: col.comment || 'none',
    }))

    // 使用 QueryBuilder 构建复杂查询
    const queryBuilder = this.propertyRepository.createQueryBuilder('property')
      .leftJoinAndSelect('property.createUser', 'createUser')
      .leftJoinAndSelect('property.updateUser', 'updateUser')

    queryBuilder.andWhereInIds(list.map(item => item.name))

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

    const map = data.reduce((acc, cur) => {
      acc[cur.propertyName] = cur
      return acc
    }, {})

    return list.map(item => {
      const temp = map[item.name]
      if (temp) {
        return {
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
        }
      }
      // 这是新增的属性
      return {
        propertyName: item.name,
        propertyType: item.type,
        type: MetaPropertyBusinessType.BUSINESS,
        createTime: null,
        updateTime: null,
        status: MetaPropertyStatus.VALID,
        createUserId: 0,
        createUsername: 'SYSTEM',
        createNickname: '系统自动生成',
        updateUserId: 0,
        updateUsername: 'SYSTEM',
        updateNickname: '系统自动生成',
      }
    })
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
