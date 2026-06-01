import { Controller, Get, Query } from '@nestjs/common'
import { HomepageService } from './homepage.service'
import {
  IHomepageOverview,
  IHomepageTrend,
  IRealtimeEventsResponse,
} from '@probe-x/shared-types/src'

@Controller('/homepage')
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  /**
   * 获取首页聚合统计
   */
  @Get('/overview')
  async getOverview(): Promise<IHomepageOverview> {
    return this.homepageService.getOverview()
  }

  /**
   * 获取趋势数据
   */
  @Get('/trend')
  async getTrend(
    @Query('days') days?: string,
  ): Promise<IHomepageTrend> {
    const daysNum = days ? parseInt(days, 10) : 7
    return this.homepageService.getTrend(daysNum)
  }

  /**
   * 获取实时事件流
   */
  @Get('/realtime-events')
  async getRealtimeEvents(
    @Query('limit') limit?: string,
  ): Promise<IRealtimeEventsResponse> {
    const limitNum = limit ? parseInt(limit, 10) : 20
    return this.homepageService.getRealtimeEvents(limitNum)
  }
}
