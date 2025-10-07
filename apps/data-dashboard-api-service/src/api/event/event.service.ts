import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, Repository } from 'typeorm'
import { MetaEventEntity } from "@entity/MetaEvent.entity"
import { EventDetailDto, EventFilterDto, PaginationDto, UpdateEventDto } from "./type"
import { IQueryEventListRes } from "@probe-x/shared-types/src"

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
    const { eventName, status } = filter

    const where = {}

    if (status) {
      where['status'] = status
    }

    if (eventName) {
      where['eventName'] = Like(`%${eventName}%`)
      where['eventAliases'] = Like(`%${eventName}%`)
    }

    const [data, total] = await this.eventRepository.findAndCount({
      where,
      relations: ['createUser', 'updateUser'],
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
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
