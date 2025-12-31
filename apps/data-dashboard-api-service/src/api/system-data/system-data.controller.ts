import { Controller, Get, Query } from '@nestjs/common'
import { MetaService } from './meta.service'
import { AnalysisService } from './analysis.service'
import {
  IDataAnalysisStatistics,
  IDataAnalysisTrend,
  ISystemDataAnalysisState,
  ISystemDataCleaningDetail,
  ISystemDataCleaningStats,
  ISystemDataMetaOverview,
  ISystemDataTrend,
} from '@probe-x/shared-types/src'

@Controller('/system-data')
export class SystemDataController {
  constructor(
    private readonly metaService: MetaService,
    private readonly dataAnalysisService: AnalysisService,
  ) {
  }

  @Get('meta/overview')
  async getMetaOverview(
    @Query('date') date?: string,
  ): Promise<ISystemDataMetaOverview> {
    return await this.metaService.getMetaOverview(date)
  }

  @Get('meta/data-trend')
  async getDataTrend(
    @Query('days') days: number = 7,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ISystemDataTrend> {
    return await this.metaService.getDataTrend(days, startDate, endDate)
  }

  @Get('meta/cleaning-stats')
  async getCleaningStats(
    @Query('date') date?: string,
  ): Promise<ISystemDataCleaningStats> {
    return await this.metaService.getCleaningStats(date)
  }

  @Get('meta/first-cleaning-detail')
  async getFirstCleaningDetail(
    @Query('date') date?: string,
  ): Promise<ISystemDataCleaningDetail> {
    return await this.metaService.getFirstCleaningDetail(date)
  }

  @Get('meta/final-cleaning-detail')
  async getFinalCleaningDetail(
    @Query('date') date?: string,
  ): Promise<ISystemDataCleaningDetail> {
    return await this.metaService.getFinalCleaningDetail(date)
  }

  @Get('analysis/statistics')
  async getAnalysisStatistics(
    @Query('date') date?: string,
  ): Promise<IDataAnalysisStatistics> {
    return await this.dataAnalysisService.getAnalysisStatistics(date)
  }

  @Get('analysis/trend')
  async getAnalysisTrend(
    @Query('days') days: number = 30,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<IDataAnalysisTrend> {
    return await this.dataAnalysisService.getAnalysisTrend(days, startDate, endDate)
  }

  @Get('analysis/tasks')
  async getAnalysisTasks(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
    @Query('status') status?: number,
  ): Promise<ISystemDataAnalysisState> {
    return await this.dataAnalysisService.getAnalysisTasks(page, pageSize, status)
  }

  @Get('analysis/hourly-trend')
  async getHourlyAnalysisTrend(
    @Query('date') date?: string,
  ): Promise<any> {
    return await this.dataAnalysisService.getHourlyAnalysisTrend(date)
  }
}
