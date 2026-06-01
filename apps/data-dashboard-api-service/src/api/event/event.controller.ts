import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { EventService } from './event.service'
import { UserService } from "../user/user.service"
import type { EventFilterDto, PaginationDto, RegisterEventDto } from "./type"

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
   * @param propertyName 如果传了这个字段，就表示需要查这个属性绑定的那些事件
   * @param status
   */
  @Get('/list')
  async getEvents(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('eventName') eventName?: string,
    @Query('propertyName') propertyName?: string,
    @Query('status') status?: number,
  ) {
    const filter: EventFilterDto = {
      propertyName,
      eventName,
      status,
    }

    const pagination: PaginationDto = {
      page: Math.max(1, page),
      pageSize: Math.max(1, Math.min(100, pageSize || 10)), // 限制每页最多100条数据
    }

    return await this.eventService.getEventsWithPagination(filter, pagination)
  }


  /**
   * 获取所有事件，简化版
   */
  @Get('/list/simple')
  async getEventsSimple() {
    return await this.eventService.getEvents()
  }

  /**
   * 注册上报发现的事件
   */
  @Post('/register')
  async registerEvent(
    @Body() registerEventDto: RegisterEventDto,
    @Req() req: any,
  ) {
    await this.eventService.registerEvent(registerEventDto, req.user)
    return { success: true }
  }
}
