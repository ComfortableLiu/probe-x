import { Controller, Get, Query } from '@nestjs/common'
import { TrackingNodeService } from "@src/api/tracking-node/tracking-node.service"
import { TrackingNodeStatus, TrackingNodeType } from "@probe-x/shared-types/src"
import { BusinessException } from "@probe-x/shared-utils/src/lib/backend-common"

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
  ) {
    if (!parentCode?.length) {
      return new BusinessException('请选择业务线')
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
}
