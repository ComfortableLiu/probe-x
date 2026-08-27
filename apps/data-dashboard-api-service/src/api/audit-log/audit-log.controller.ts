import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AuditLogService } from './audit-log.service'
import { IQueryAuditLogListReq, IQueryAuditLogListRes } from '@probe-x/shared-types/src'
import { AdminGuard } from '../../guard/admin.guard'

@Controller('audit-log')
@UseGuards(AdminGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('list')
  async getList(
    @Query('username') username?: string,
    @Query('action') action?: string,
    @Query('method') method?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<IQueryAuditLogListRes> {
    const params: IQueryAuditLogListReq = {
      username,
      action,
      method,
      startTime,
      endTime,
      page: page || 1,
      pageSize: Math.min(pageSize || 20, 100), // 限制每页最多100条数据
    }
    return await this.auditLogService.getList(params)
  }
}
