import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MetaEventEntity } from "@entity/MetaEvent.entity"
import { EventDetailDto, EventFilterDto, PaginationDto, UpdateEventDto } from "./type"

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
  ): Promise<[MetaEventEntity[], number]> {
    const { page, pageSize } = pagination
    const { eventName, status } = filter

    const queryBuilder = this.eventRepository.createQueryBuilder('event')
      .leftJoinAndSelect('user', 'update', 'event.updateUserId = update.userId')
      .leftJoinAndSelect('user', 'create', 'event.createUserId = create.userId')

    // 应用筛选条件
    if (eventName) {
      queryBuilder.andWhere('event.eventName LIKE :eventName', {
        eventName: `%${eventName}%`,
      })
      queryBuilder.andWhere('event.eventAliases LIKE :eventName', {
        eventName: `%${eventName}%`,
      })
    }

    if (status !== undefined) {
      queryBuilder.andWhere('event.status = :status', { status })
    }

    // 应用分页
    queryBuilder.skip((page - 1) * pageSize).take(pageSize)

    const raw = await queryBuilder.getRawMany()
    const [data, total] = await queryBuilder.getManyAndCount()
    return [data.map((item, index) => ({
      ...item,
      createUsername: raw[index].create_username,
      createNickname: raw[index].create_nickname,
      updateUsername: raw[index].update_username,
      updateNickname: raw[index].update_nickname,
    })), total]
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
