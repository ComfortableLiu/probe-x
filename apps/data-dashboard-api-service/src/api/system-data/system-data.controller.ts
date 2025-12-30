import { Controller, Get, Query } from '@nestjs/common'
import { SystemDataService } from './system-data.service'
import {
  ISystemDataCleaningDetail,
  ISystemDataCleaningStats,
  ISystemDataMetaOverview,
  ISystemDataTrend,
} from '@probe-x/shared-types/src'

@Controller('/system-data')
export class SystemDataController {
  constructor(
    private readonly systemDataService: SystemDataService,
  ) {
  }

  @Get('meta/overview')
  async getMetaOverview(
    @Query('date') date?: string,
  ): Promise<ISystemDataMetaOverview> {
    return await this.systemDataService.getMetaOverview(date)
  }

  @Get('meta/data-trend')
  async getDataTrend(
    @Query('days') days: number = 7,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ISystemDataTrend> {
    return await this.systemDataService.getDataTrend(days, startDate, endDate)
  }

  @Get('meta/cleaning-stats')
  async getCleaningStats(
    @Query('date') date?: string,
  ): Promise<ISystemDataCleaningStats> {
    return await this.systemDataService.getCleaningStats(date)
  }

  @Get('meta/first-cleaning-detail')
  async getFirstCleaningDetail(
    @Query('date') date?: string,
  ): Promise<ISystemDataCleaningDetail> {
    return await this.systemDataService.getFirstCleaningDetail(date)
  }

  @Get('meta/final-cleaning-detail')
  async getFinalCleaningDetail(
    @Query('date') date?: string,
  ): Promise<ISystemDataCleaningDetail> {
    return await this.systemDataService.getFinalCleaningDetail(date)
  }
}
