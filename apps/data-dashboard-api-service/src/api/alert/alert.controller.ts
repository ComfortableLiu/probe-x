import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { AlertService } from './alert.service'
import {
  AlertLevel,
  ICreateAlertRuleReq,
  ICreateAlertRuleRes,
  IDeleteAlertRuleReq,
  IQueryAlertRuleListReq,
  IQueryAlertRuleListRes,
  IQueryAlertHistoryListReq,
  IQueryAlertHistoryListRes,
  IToggleAlertRuleReq,
  IUpdateAlertRuleReq,
  IUpdateAlertRuleRes,
} from '@probe-x/shared-types/src'
import { ResponseData, User } from '@probe-x/shared-utils/src/lib/backend-common'
import { AdminGuard } from '../../guard/admin.guard'

@UseGuards(AdminGuard)
@Controller('alert')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  /**
   * 获取告警规则列表
   */
  @Get('rules')
  async getRuleList(
    @Query('name') name?: string,
    @Query('level') level?: string,
    @Query('enabled') enabled?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<IQueryAlertRuleListRes> {
    const params: IQueryAlertRuleListReq = {
      name,
      level: level as AlertLevel,
      enabled: enabled === 'true' || enabled === '1' ? true : enabled === 'false' || enabled === '0' ? false : undefined,
      page: page || 1,
      pageSize: Math.min(pageSize || 20, 100), // 限制每页最多100条数据
    }
    return await this.alertService.getRuleList(params)
  }

  /**
   * 创建告警规则
   */
  @Post('rules/create')
  async createRule(
    @Body() body: ICreateAlertRuleReq,
    @User('userId') userId: number,
  ): Promise<ResponseData<ICreateAlertRuleRes>> {
    return await this.alertService.createRule(body, userId)
  }

  /**
   * 更新告警规则
   */
  @Post('rules/update')
  async updateRule(@Body() body: IUpdateAlertRuleReq): Promise<ResponseData<IUpdateAlertRuleRes>> {
    return await this.alertService.updateRule(body)
  }

  /**
   * 删除告警规则
   */
  @Post('rules/delete')
  async deleteRule(@Body() body: IDeleteAlertRuleReq): Promise<ResponseData<null>> {
    return await this.alertService.deleteRule(body.id)
  }

  /**
   * 启用/禁用告警规则
   */
  @Post('rules/toggle')
  async toggleRule(@Body() body: IToggleAlertRuleReq): Promise<ResponseData<null>> {
    return await this.alertService.toggleRule(body.id, body.enabled)
  }

  /**
   * 获取告警历史列表
   */
  @Get('history')
  async getHistoryList(
    @Query('ruleId') ruleId?: string,
    @Query('level') level?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<IQueryAlertHistoryListRes> {
    const params: IQueryAlertHistoryListReq = {
      ruleId: ruleId ? Number(ruleId) : undefined,
      level: level as AlertLevel,
      startTime,
      endTime,
      page: page || 1,
      pageSize: Math.min(pageSize || 20, 100), // 限制每页最多100条数据
    }
    return await this.alertService.getHistoryList(params)
  }
}
