import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { EventDetailDto, EventFilterDto, PaginationDto, RegisterEventDto, UpdateEventDto } from "./type"
import { IEventListItem, IQueryEventListRes, IQueryEventListSimpleRes, MetaEventStatus } from "@probe-x/shared-types/src"
import { BusinessException, ClickHouseService, MetaEventEntity } from "@probe-x/shared-utils/src/lib/backend-common"

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(MetaEventEntity)
    private eventRepository: Repository<MetaEventEntity>,
    private readonly clickhouseService: ClickHouseService,
  ) {
  }

  /**
   * 从 ClickHouse 获取近 7 天上报但未在 meta_event 中注册的事件名
   */
  async getUnregisteredEvents(): Promise<string[]> {
    // 查询近 7 天 ClickHouse 中的 distinct 事件名
    const reportedEvents = await this.clickhouseService.query<{ event_name: string }>(
      "SELECT DISTINCT `$event_name` AS event_name FROM event_log WHERE `$service_time` >= now() - INTERVAL 7 DAY"
    )
    const reportedNames = reportedEvents.map(e => e.event_name)

    if (reportedNames.length === 0) {
      return []
    }

    // 查询已注册的事件名
    const registeredEvents = await this.eventRepository.find({
      select: ['eventName'],
    })
    const registeredNames = new Set(registeredEvents.map(e => e.eventName))

    // 返回未注册的事件名
    return reportedNames.filter(name => !registeredNames.has(name))
  }

  /**
   * 注册一个上报发现的事件到 meta_event 表
   */
  async registerEvent(registerEventDto: RegisterEventDto, user: any): Promise<void> {
    const { eventName, eventAliases, eventRemark } = registerEventDto

    // 检查是否已存在
    const existing = await this.eventRepository.findOne({
      where: { eventName },
    })

    if (existing) {
      throw new BusinessException('事件已存在')
    }

    const event = this.eventRepository.create({
      eventName,
      eventAliases: eventAliases || '',
      eventRemark: eventRemark || '',
      status: MetaEventStatus.VALID,
      createUserId: user.userId,
      updateUserId: user.userId,
    })

    await this.eventRepository.save(event)
  }

  async getEventsWithPagination(
    filter: EventFilterDto,
    pagination: PaginationDto,
  ): Promise<IQueryEventListRes> {
    const { page, pageSize } = pagination
    const { eventName, status, propertyName } = filter

    // 是否需要合并未注册事件（无 status 且无 propertyName 过滤时）
    const needMerge = !status && !propertyName

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

    // 需要合并时查全量 MySQL 数据，否则用数据库分页
    let configuredEvents: IEventListItem[]
    let total: number

    if (needMerge) {
      const data = await queryBuilder.getMany()
      total = data.length
      configuredEvents = data.map(event => this.toEventListItem(event))
    } else {
      queryBuilder.skip((page - 1) * pageSize).take(pageSize)
      const [data, count] = await queryBuilder.getManyAndCount()
      total = count
      configuredEvents = data.map(event => this.toEventListItem(event))
    }

    // 上报事件不支持状态和属性筛选，只在无这些筛选时合并
    let allEvents: IEventListItem[]
    if (needMerge) {
      // 获取未注册的上报事件
      const unregisteredNames = await this.getUnregisteredEvents()

      // 过滤未注册事件（按 eventName 筛选）
      const filteredUnregistered = eventName
        ? unregisteredNames.filter(name => name.includes(eventName))
        : unregisteredNames

      // 构造上报事件列表项
      const reportedEvents: IEventListItem[] = filteredUnregistered.map(name => ({
        eventName: name,
        eventAliases: '',
        eventRemark: '',
        createTime: null as any,
        updateTime: null as any,
        status: null as any,
        createUserId: null as any,
        createUsername: '',
        createNickname: '',
        updateUserId: null as any,
        updateUsername: '',
        updateNickname: '',
        source: 'reported' as const,
      }))

      allEvents = [...configuredEvents, ...reportedEvents]
      total = allEvents.length
    } else {
      allEvents = configuredEvents
    }

    // 手动分页
    const start = (page - 1) * pageSize
    const pagedData = allEvents.slice(start, start + pageSize)

    return {
      data: pagedData,
      total,
      page,
      pageSize,
    }
  }

  private toEventListItem(event: MetaEventEntity): IEventListItem {
    return {
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
      source: 'configured' as const,
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
    if (user.userId !== undefined) updateData.updateUserId = user.userId
    updateData.updateTime = new Date()

    const result = await this.eventRepository.update({ eventName }, updateData)
    return result.affected !== null && result.affected > 0
  }
}
