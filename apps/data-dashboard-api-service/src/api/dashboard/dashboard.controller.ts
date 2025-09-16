import { Controller, Get, Query, Param } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { IAnyObj } from '@shared-types';

@Controller('/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // 获取仪表板概览数据
  @Get('/overview')
  async getOverview(@Query() query: IAnyObj) {
    return this.dashboardService.getOverview(query);
  }

  // 获取实时数据统计
  @Get('/realtime')
  async getRealtimeData(@Query() query: IAnyObj) {
    return this.dashboardService.getRealtimeData(query);
  }

  // 获取页面访问趋势
  @Get('/trends')
  async getPageTrends(@Query() query: IAnyObj) {
    return this.dashboardService.getPageTrends(query);
  }

  // 获取用户行为分析
  @Get('/user-behavior')
  async getUserBehavior(@Query() query: IAnyObj) {
    return this.dashboardService.getUserBehavior(query);
  }

  // 获取设备统计
  @Get('/device-stats')
  async getDeviceStats(@Query() query: IAnyObj) {
    return this.dashboardService.getDeviceStats(query);
  }

  // 获取地理位置分布
  @Get('/geo-distribution')
  async getGeoDistribution(@Query() query: IAnyObj) {
    return this.dashboardService.getGeoDistribution(query);
  }
}
