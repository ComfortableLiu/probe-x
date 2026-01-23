import { Body, Controller, Delete, Get, ParseIntPipe, Post, Query } from '@nestjs/common'
import { User } from '@probe-x/shared-utils/src/lib/backend-common'
import {
  IUser,
  ICreateDashboardReq,
  IUpdateDashboardReq,
  IQueryDashboardListReq,
  IDashboard,
  IDashboardListRes,
  IQueryDashboardDataReq,
  IDashboardDataRes,
  IConvertToPublicDashboardReq,
} from '@probe-x/shared-types/src'
import { DashboardService } from './dashboard.service'

@Controller('/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * 创建看板
   */
  @Post('/create')
  async createDashboard(
    @Body() data: ICreateDashboardReq,
    @User() user: IUser,
  ): Promise<IDashboard> {
    return this.dashboardService.createDashboard(data, user)
  }

  /**
   * 更新看板
   */
  @Post('/update')
  async updateDashboard(
    @Body() data: IUpdateDashboardReq,
    @User() user: IUser,
  ): Promise<IDashboard> {
    return this.dashboardService.updateDashboard(data, user)
  }

  /**
   * 删除看板
   */
  @Delete('/delete')
  async deleteDashboard(
    @Query('id', ParseIntPipe) id: number,
    @User() user: IUser,
  ): Promise<void> {
    return this.dashboardService.deleteDashboard(id, user)
  }

  /**
   * 获取单个看板信息
   */
  @Get('/detail')
  async getDashboard(
    @Query('id', ParseIntPipe) id: number,
    @User() user: IUser,
  ): Promise<IDashboard> {
    return this.dashboardService.getDashboard(id, user)
  }

  /**
   * 查询看板列表
   */
  @Get('/list')
  async queryDashboardList(
    @Query() query: IQueryDashboardListReq,
    @User() user: IUser,
  ): Promise<IDashboardListRes> {
    return this.dashboardService.queryDashboardList(query, user)
  }

  /**
   * 查询看板数据
   */
  @Post('/data')
  async queryDashboardData(
    @Body() data: IQueryDashboardDataReq,
    @User() user: IUser,
  ): Promise<IDashboardDataRes> {
    return this.dashboardService.queryDashboardData(data, user)
  }

  /**
   * 将个人看板转为公共看板
   */
  @Post('/convert-to-public')
  async convertToPublicDashboard(
    @Body() data: IConvertToPublicDashboardReq,
    @User() user: IUser,
  ): Promise<IDashboard> {
    return this.dashboardService.convertToPublicDashboard(data, user)
  }
}
