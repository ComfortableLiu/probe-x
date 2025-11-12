import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { EventDetailDto, EventFilterDto, PaginationDto, UpdateEventDto } from "./type"
import { IQueryEventListRes, IQueryEventListSimpleRes, MetaEventStatus } from "@probe-x/shared-types/src"
import { MetaEventEntity } from "@probe-x/shared-utils/src/lib/backend-common"

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(MetaEventEntity)
    private eventRepository: Repository<MetaEventEntity>,
  ) {
  }

  async getEventsWithPagination(
    filter: EventFilterDto,
    pagination: PaginationDto,
  ): Promise<IQueryEventListRes> {
    const { page, pageSize } = pagination
    const { eventName, status, propertyName } = filter

    // 使用 QueryBuilder 构建复杂查询
    const queryBuilder = this.eventRepository.createQueryBuilder('event')
      .leftJoinAndSelect('event.createUser', 'createUser')
      .leftJoinAndSelect('event.updateUser', 'updateUser')

    // 添加状态过滤条件
    if (status) {
      queryBuilder.andWhere('event.status = :status', { status })
    }

    // 根据事件名称筛选属性
    if (propertyName) {
      queryBuilder.innerJoin('event.eventPropertyRelations', 'relation')
        .innerJoin('relation.metaProperty', 'metaProperty')
        .andWhere('metaProperty.propertyName = :propertyName', { propertyName })
    }

    // 添加事件名称模糊匹配条件
    if (eventName) {
      queryBuilder.andWhere('(event.eventName LIKE :eventName OR event.eventAliases LIKE :eventAliases)', {
        eventName: `%${eventName}%`,
        eventAliases: `%${eventName}%`,
      })
    }

    // 添加分页
    queryBuilder.skip((page - 1) * pageSize)
      .take(pageSize)

    const [data, total] = await queryBuilder.getManyAndCount()

    return {
      data: data.map(event => ({
        eventName: event.eventName,
        eventAliases: event.eventAliases,
        eventRemark: event.eventRemark,
        createTime: event.createTime,
        updateTime: event.updateTime,
        status: event.status,
        createUserId: event.createUser?.userId,
        createUsername: event.createUser?.username,
        createNickname: event.createUser?.nickname,
        updateUserId: event.updateUser?.userId,
        updateUsername: event.updateUser?.username,
        updateNickname: event.updateUser?.nickname,
      })),
      total,
      page,
      pageSize,
    }
  }

  async getEvents(): Promise<IQueryEventListSimpleRes> {
    const data = await this.eventRepository.find({
      where: {
        status: MetaEventStatus.VALID,
      },
    })

    return data.map(event => ({
      eventName: event.eventName,
      eventAliases: event.eventAliases,
      eventRemark: event.eventRemark,
    }))
  }

  async getEventDetailByEventName(eventName: string): Promise<EventDetailDto | null> {
    const event = await this.eventRepository.findOne({
      where: { eventName },
      relations: ['eventPropertyRelations', 'eventPropertyRelations.metaProperty'],
    })

    if (!event) {
      return null
    }

    // 构造返回结果
    return {
      eventName: event.eventName!,
      eventAliases: event.eventAliases!,
      eventRemark: event.eventRemark!,
      createTime: event.createTime!,
      createUserId: event.createUserId!,
      updateUserId: event.updateUserId!,
      updateTime: event.updateTime!,
      status: event.status!,
      properties: event.eventPropertyRelations?.map(relation => ({
        propertyName: relation.metaProperty?.propertyName!,
        propertyType: relation.metaProperty?.propertyType!,
        eventPropertyRemark: relation.eventPropertyRemark!,
        creatTime: relation.createTime!,
      })) || [],
    }
  }

  async updateEventByName(eventName: string, updateEventDto: UpdateEventDto, user: any): Promise<boolean> {
    const { eventAliases, eventRemark, status } = updateEventDto

    const updateData: any = {}
    if (eventAliases !== undefined) updateData.eventAliases = eventAliases
    if (eventRemark !== undefined) updateData.eventRemark = eventRemark
    if (status !== undefined) updateData.status = status
    if (user.id !== undefined) updateData.updateUserId = user.id
    updateData.updateTime = new Date()

    const result = await this.eventRepository.update({ eventName }, updateData)
    return result.affected !== null && result.affected > 0
  }
}
