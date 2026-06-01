import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { NotificationService } from './notification.service'
import {
  ICreateNotificationReq,
  ICreateNotificationRes,
  IDeleteNotificationReq,
  IQueryNotificationListReq,
  IQueryNotificationListRes,
  ITestSendNotificationRes,
  IUpdateNotificationReq,
  IUpdateNotificationRes,
} from '@probe-x/shared-types/src'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common'
import { AdminGuard } from '../../guard/admin.guard'

@UseGuards(AdminGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('list')
  async getList(
    @Query('notificationName') notificationName?: string,
    @Query('notificationType') notificationType?: string,
    @Query('isEnable') isEnable?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<IQueryNotificationListRes> {
    const params: IQueryNotificationListReq = {
      notificationName,
      notificationType: notificationType as any,
      isEnable: isEnable === 'true' || isEnable === '1' ? true : isEnable === 'false' || isEnable === '0' ? false : undefined,
      page: page || 1,
      pageSize: pageSize || 20,
    }
    return await this.notificationService.getList(params)
  }

  @Post('create')
  async create(@Body() body: ICreateNotificationReq): Promise<ResponseData<ICreateNotificationRes>> {
    return await this.notificationService.create(body)
  }

  @Post('update')
  async update(@Body() body: IUpdateNotificationReq): Promise<ResponseData<IUpdateNotificationRes>> {
    return await this.notificationService.update(body)
  }

  @Post('delete')
  async delete(@Body() body: IDeleteNotificationReq): Promise<ResponseData<null>> {
    return await this.notificationService.delete(body.id)
  }

  @Post('test-send')
  async testSend(@Body() body: { id: number }): Promise<ResponseData<ITestSendNotificationRes>> {
    return await this.notificationService.testSend(body.id)
  }
}
