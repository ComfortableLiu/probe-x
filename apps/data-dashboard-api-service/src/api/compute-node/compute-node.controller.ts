import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { ComputeNodeService } from './compute-node.service'
import {
  IComputeNodeListItem,
  ICreateComputeNodeReq,
  ICreateComputeNodeRes,
  IDeleteComputeNodeReq,
  IQueryComputeNodeListReq,
  IQueryComputeNodeListRes,
  IUpdateComputeNodeReq,
  IUpdateComputeNodeRes,
} from '@probe-x/shared-types/src'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common'
import { AdminGuard } from '../../guard/admin.guard'

@UseGuards(AdminGuard)
@Controller('compute-node')
export class ComputeNodeController {
  constructor(private readonly computeNodeService: ComputeNodeService) {}

  @Get('list')
  async getList(
    @Query('nodeName') nodeName?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<IQueryComputeNodeListRes> {
    const params: IQueryComputeNodeListReq = {
      nodeName,
      status: status as any,
      page: page || 1,
      pageSize: pageSize || 20,
    }
    return await this.computeNodeService.getList(params)
  }

  @Post('create')
  async create(@Body() body: ICreateComputeNodeReq): Promise<ResponseData<ICreateComputeNodeRes>> {
    return await this.computeNodeService.create(body)
  }

  @Post('update')
  async update(@Body() body: IUpdateComputeNodeReq): Promise<ResponseData<IUpdateComputeNodeRes>> {
    return await this.computeNodeService.update(body)
  }

  @Post('delete')
  async delete(@Body() body: IDeleteComputeNodeReq): Promise<ResponseData<null>> {
    return await this.computeNodeService.delete(body.id)
  }
}
