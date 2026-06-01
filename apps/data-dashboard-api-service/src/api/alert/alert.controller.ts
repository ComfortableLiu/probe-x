import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { AlertService } from './alert.service'
import {
  ICreateAlertRuleReq,
  ICreateAlertRuleRes,
  IDeleteAlertRuleReq,
  IQueryAlertRuleListReq,
  IQueryAlertRuleListRes,
  IQueryAlertHistoryListReq,
  IQueryAlertHistoryListRes,
  IUpdateAlertRuleReq,
  IUpdateAlertRuleRes,
} from '@probe-x/shared-types/src'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common'
import { AdminGuard } from '../../guard/admin.guard'

@UseGuards(AdminGuard)
@Controller('alert')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Get('rules')
  async getRuleList(
    @Query('ruleName') ruleName?: string,
    @Query('ruleType') ruleType?: string,
    @Query('isEnable') isEnable?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<IQueryAlertRuleListRes> {
    const params: IQueryAlertRuleListReq = {
      ruleName,
      ruleType: ruleType as any,
      isEnable: isEnable === 'true' || isEnable === '1' ? true : isEnable === 'false' || isEnable === '0' ? false : undefined,
      page: page || 1,
      pageSize: pageSize || 20,
    }
    return await this.alertService.getRuleList(params)
  }

  @Post('rules/create')
  async createRule(@Body() body: ICreateAlertRuleReq): Promise<ResponseData<ICreateAlertRuleRes>> {
    return await this.alertService.createRule(body)
  }

  @Post('rules/update')
  async updateRule(@Body() body: IUpdateAlertRuleReq): Promise<ResponseData<IUpdateAlertRuleRes>> {
    return await this.alertService.updateRule(body)
  }

  @Post('rules/delete')
  async deleteRule(@Body() body: IDeleteAlertRuleReq): Promise<ResponseData<null>> {
    return await this.alertService.deleteRule(body.id)
  }

  @Get('history')
  async getHistoryList(
    @Query('alertLevel') alertLevel?: string,
    @Query('alertRuleId') alertRuleId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<IQueryAlertHistoryListRes> {
    const params: IQueryAlertHistoryListReq = {
      alertLevel: alertLevel as any,
      alertRuleId: alertRuleId ? Number(alertRuleId) : undefined,
      startTime,
      endTime,
      page: page || 1,
      pageSize: pageSize || 20,
    }
    return await this.alertService.getHistoryList(params)
  }
}
