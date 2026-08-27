import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { DataSourceService } from './datasource.service'
import {
  ICreateDataSourceReq,
  ICreateDataSourceRes,
  IDeleteDataSourceReq,
  IQueryDataSourceListReq,
  IQueryDataSourceListRes,
  ITestDataSourceConnectionRes,
  IUpdateDataSourceReq,
  IUpdateDataSourceRes,
} from '@probe-x/shared-types/src'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common'
import { AdminGuard } from '../../guard/admin.guard'

@UseGuards(AdminGuard)
@Controller('datasource')
export class DataSourceController {
  constructor(private readonly dataSourceService: DataSourceService) {}

  @Get('list')
  async getList(
    @Query('datasourceName') datasourceName?: string,
    @Query('datasourceType') datasourceType?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<IQueryDataSourceListRes> {
    const params: IQueryDataSourceListReq = {
      datasourceName,
      datasourceType: datasourceType as any,
      page: page || 1,
      pageSize: Math.min(pageSize || 20, 100), // 限制每页最多100条数据
    }
    return await this.dataSourceService.getList(params)
  }

  @Post('create')
  async create(@Body() body: ICreateDataSourceReq): Promise<ResponseData<ICreateDataSourceRes>> {
    return await this.dataSourceService.create(body)
  }

  @Post('update')
  async update(@Body() body: IUpdateDataSourceReq): Promise<ResponseData<IUpdateDataSourceRes>> {
    return await this.dataSourceService.update(body)
  }

  @Post('delete')
  async delete(@Body() body: IDeleteDataSourceReq): Promise<ResponseData<null>> {
    return await this.dataSourceService.delete(body.id)
  }

  @Post('test-connection')
  async testConnection(@Body() body: { id: number }): Promise<ResponseData<ITestDataSourceConnectionRes>> {
    return await this.dataSourceService.testConnection(body.id)
  }
}
