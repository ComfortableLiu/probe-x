import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MetaEventEntity } from "@entity/MetaEvent.entity"
import { EventDetailDto, EventFilterDto, PaginationDto, UpdateEventDto } from "@src/api/event/type"

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
    const { eventName, eventAliases, status } = filter

    const queryBuilder = this.eventRepository.createQueryBuilder('event')

    // 应用筛选条件
    if (eventName) {
      queryBuilder.andWhere('event.eventName LIKE :eventName', {
        eventName: `%${eventName}%`,
      })
    }

    if (eventAliases) {
      queryBuilder.andWhere('event.eventAliases LIKE :eventAliases', {
        eventAliases: `%${eventAliases}%`,
      })
    }

    if (status !== undefined) {
      queryBuilder.andWhere('event.status = :status', { status })
    }

    // 应用分页
    queryBuilder.skip((page - 1) * pageSize).take(pageSize)

    return await queryBuilder.getManyAndCount()
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
      creatTime: event.creatTime!,
      creatUserId: event.creatUserId!,
      updateUserId: event.updateUserId!,
      updateTime: event.updateTime!,
      status: event.status!,
      properties: event.eventPropertyRelations?.map(relation => ({
        propertyName: relation.metaProperty?.propertyName!,
        propertyType: relation.metaProperty?.propertyType!,
        eventPropertyRemark: relation.eventPropertyRemark!,
        creatTime: relation.creatTime!,
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
