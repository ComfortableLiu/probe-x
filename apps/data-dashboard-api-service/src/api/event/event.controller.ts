import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common'
import { EventService } from './event.service'
import { UserService } from "../user/user.service"
import { EventFilterDto, PaginationDto, UpdateEventDto } from "./type"

@Controller('/event')
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly userService: UserService,
  ) {
  }

  /**
   * 获取所有事件
   *
   * @param page
   * @param pageSize
   * @param eventName
   * @param eventAliases
   * @param status
   */
  @Get('/list')
  async getEvents(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('eventName') eventName?: string,
    @Query('eventAliases') eventAliases?: string,
    @Query('status') status?: number,
  ) {
    const filter: EventFilterDto = {
      eventName,
      eventAliases,
      status,
    }

    const pagination: PaginationDto = {
      page: Math.max(1, page),
      pageSize: Math.max(1, Math.min(100, pageSize || 10)), // 限制每页最多100条数据
    }

    const [data, total] = await this.eventService.getEventsWithPagination(filter, pagination)

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
  }

  /**
   * 根据事件名获取事件详情
   * @param eventName
   */
  @Get('/detail/:eventName')
  async getEventDetail(@Param('eventName') eventName: string) {
    const eventDetail = await this.eventService.getEventDetailByEventName(eventName)
    if (!eventDetail) {
      return {
        statusCode: 404,
        message: 'Event not found',
      }
    }

    return {
      data: eventDetail,
    }
  }

  /**
   * 更新事件的主属性，不包括关联的属性
   * @param eventName
   * @param updateEventDto
   * @param userId
   */
  @Post('/update/:eventName')
  async updateEvent(
    @Param('eventName') eventName: string,
    @Body() updateEventDto: UpdateEventDto,
    @Headers('x-probe-x-staff-id') userId: number,
  ) {
    const user = await this.userService.getUserById(userId)
    const result = await this.eventService.updateEventByName(eventName, updateEventDto, user)

    if (!result) {
      return {
        statusCode: 404,
        message: 'Event not found or update failed',
      }
    }

    return {
      statusCode: 200,
      message: 'Event updated successfully',
    }
  }
}
