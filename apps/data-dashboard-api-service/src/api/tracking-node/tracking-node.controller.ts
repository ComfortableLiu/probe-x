import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { Request } from 'express'
import { TrackingNodeService } from "@src/api/tracking-node/tracking-node.service"
import type {
  ICreateBusinessSiteReq,
  ICreateSpmNodeReq,
  IUpdateBusinessSiteReq,
  IUpdateSpmNodeReq,
  IUser,
} from "@probe-x/shared-types/src"
import { TrackingNodeStatus, TrackingNodeType } from "@probe-x/shared-types/src"
import { BusinessException, User } from "@probe-x/shared-utils/src/lib/backend-common"

@Controller('tracking')
export class TrackingNodeController {
  constructor(
    private readonly trackingNodeService: TrackingNodeService,
  ) {
  }

  /**
   * 分页获取全部SPM
   * @param page
   * @param pageSize
   * @param name
   * @param code
   * @param parentCode
   * @param status
   */
  @Get('spm/list')
  async getSpmList(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('name') name: string,
    @Query('code') code: string,
    @Query('parentCode') parentCode: string,
    @Query('status') status?: TrackingNodeStatus,
    @Req() request?: Request,
  ) {
    // 处理 parentCode[] 格式的参数（axios 序列化可能产生的格式）
    if (!parentCode && request?.query?.['parentCode[]']) {
      parentCode = String(request.query['parentCode[]'])
    }
    
    if (!parentCode?.length) {
      throw new BusinessException('请选择业务线')
    }
    return await this.trackingNodeService.getTrackingNodeList(
      page,
      pageSize,
      parentCode,
      TrackingNodeType.SPM,
      name,
      code,
      status,
    )
  }

  /**
   * 获取SPM.A
   */
  @Get('spm/business/list')
  async getBusinessList() {
    return await this.trackingNodeService.getBusinessList()
  }

  @Post('spm/business/create')
  async createBusiness(
    @Body() data: ICreateBusinessSiteReq,
    @User() user: IUser,
  ) {
    return await this.trackingNodeService.createBusiness(data, user)
  }

  @Post('spm/business/update')
  async updateBusiness(
    @Body() data: IUpdateBusinessSiteReq,
    @User() user: IUser,
  ) {
    return await this.trackingNodeService.updateBusiness(data, user)
  }

  @Post('spm/node/create')
  async createSpmNode(
    @Body() data: ICreateSpmNodeReq,
    @User() user: IUser,
  ) {
    return await this.trackingNodeService.createSpmNode(data, user)
  }

  @Post('spm/node/update')
  async updateSpmNode(
    @Body() data: IUpdateSpmNodeReq,
    @User() user: IUser,
  ) {
    return await this.trackingNodeService.updateSpmNode(data, user)
  }
}
