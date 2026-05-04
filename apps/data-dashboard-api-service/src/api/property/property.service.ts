import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import {
  ICreatePropertyReq,
  ICreatePropertyRes,
  IQueryCommonPropertyListRes,
  IQueryPropertyListRes,
  IQueryPropertyListSimpleRes,
  MetaPropertyBusinessType,
  MetaPropertyStatus,
  MetaPropertyTypeMap,
} from "@probe-x/shared-types/src"
import { PropertyFilterDto } from "./type"
import { ClickHouseService, MetaPropertyEntity } from "@probe-x/shared-utils/src/lib/backend-common"

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

    // 查询ClickHouse event_log的列
    const clickhouseColumns: {
      name: string,
      type: string,
      comment: string
    } = await this.clickhouseService.executeDDL(`
        SELECT name, type, comment
        FROM system.columns
        WHERE table = 'event_log'
          AND database = currentDatabase()
    `)
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

  async getPropertyList(): Promise<IQueryPropertyListSimpleRes> {
    const data = await this.propertyRepository.find({
      where: {
        status: MetaPropertyStatus.VALID,
      },
    })

    return data.map(temp => ({
      propertyName: temp.propertyName,
      propertyType: temp.propertyType,
      type: temp.type,
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
    // 校验属性名只允许字母、数字、下划线，防止 SQL 注入
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(data.propertyName)) {
      throw new Error('属性名只能包含字母、数字和下划线，且必须以字母或下划线开头')
    }
    // 转义 comment 中的单引号，防止 SQL 注入
    const escapedComment = (data.comment || '').replace(/'/g, "\\'")
    const columnType = MetaPropertyTypeMap[data.propertyType]
    if (!columnType) {
      throw new Error('无效的属性类型')
    }
    // 先创建ClickHouse的列
    await this.clickhouseService.executeDDL(
      `ALTER TABLE \`event_log\` ADD COLUMN IF NOT EXISTS \`${data.propertyName}\` ${columnType} COMMENT '${escapedComment}'`
    )
    // 保存到自定义数据库中
    const property = await this.propertyRepository.save({
      propertyName: data.propertyName,
      propertyType: data.propertyType,
      type: data.type,
      status: MetaPropertyStatus.VALID,
    })
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
