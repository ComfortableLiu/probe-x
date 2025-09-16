import { Controller, Get, Query, Param, Post, Body } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { IAnyObj } from '@shared-types';

@Controller('/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // 获取漏斗分析
  @Get('/funnel')
  async getFunnelAnalysis(@Query() query: IAnyObj) {
    return this.analyticsService.getFunnelAnalysis(query);
  }

  // 获取留存分析
  @Get('/retention')
  async getRetentionAnalysis(@Query() query: IAnyObj) {
    return this.analyticsService.getRetentionAnalysis(query);
  }

  // 获取事件分析
  @Get('/events')
  async getEventAnalysis(@Query() query: IAnyObj) {
    return this.analyticsService.getEventAnalysis(query);
  }

  // 获取自定义报告
  @Get('/reports')
  async getCustomReports(@Query() query: IAnyObj) {
    return this.analyticsService.getCustomReports(query);
  }

  // 创建自定义报告
  @Post('/reports')
  async createCustomReport(@Body() reportData: IAnyObj) {
    return this.analyticsService.createCustomReport(reportData);
  }

  // 获取数据导出
  @Get('/export')
  async exportData(@Query() query: IAnyObj) {
    return this.analyticsService.exportData(query);
  }
}
