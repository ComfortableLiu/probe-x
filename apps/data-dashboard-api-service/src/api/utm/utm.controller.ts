import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { UtmService } from './utm.service'
import {
  IDeleteUtmReq,
  IQueryUtmListReq,
  IQueryUtmListRes,
  IQueryUtmOptionsRes,
  IRecalcUtmReq,
  IRecalcUtmRes,
  IRestoreUtmReq,
  IRestoreUtmRes,
  IUtmStatCursorRes,
  IUtmStatIncrementReq,
  IUtmStatSyncReq,
  IUtmStatSyncRes,
  IUpdateUtmReq,
  IUpdateUtmRes,
  UtmDimension,
} from '@probe-x/shared-types/src'
import { User } from '@probe-x/shared-utils/src/lib/backend-common'

@Controller('utm')
export class UtmController {
  constructor(private readonly utmService: UtmService) {
  }

  /**
   * 分页查询 UTM 条目
   * isDeleted=1 查「已删除」视图，否则查有效条目
   */
  @Get('list')
  async getList(
    @Query('dimension') dimension?: UtmDimension,
    @Query('value') value?: string,
    @Query('alias') alias?: string,
    @Query('isDeleted') isDeleted?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<IQueryUtmListRes> {
    const params: IQueryUtmListReq = {
      dimension,
      value,
      alias,
      isDeleted: isDeleted === 'true' || isDeleted === '1',
      page: page || 1,
      // 限制每页最多100条数据
      pageSize: Math.min(pageSize || 20, 100),
    }
    return await this.utmService.getList(params)
  }

  /**
   * UTM 取值选项（UTM 分析的取值筛选器用）
   * 只返回有效条目，带别名，一次性返回不分页
   */
  @Get('options')
  async getOptions(@Query('dimension') dimension?: UtmDimension): Promise<IQueryUtmOptionsRes> {
    return await this.utmService.getOptions(dimension)
  }

  /**
   * 更新别名 / 描述（取值本身来自埋点上报，不允许改）
   */
  @Post('update')
  async update(
    @Body() body: IUpdateUtmReq,
    @User('userId') userId: string | number,
  ): Promise<IUpdateUtmRes> {
    return await this.utmService.update(Number(body.id), body, Number(userId))
  }

  /**
   * 软删除：不物理删除，后续统计不再计入该取值，UTM 分析也忽略它
   */
  @Post('delete')
  async remove(
    @Body() body: IDeleteUtmReq,
    @User('userId') userId: string | number,
  ): Promise<null> {
    return await this.utmService.remove(Number(body.id), Number(userId))
  }

  /**
   * 恢复已删除的条目
   */
  @Post('restore')
  async restore(
    @Body() body: IRestoreUtmReq,
    @User('userId') userId: string | number,
  ): Promise<IRestoreUtmRes> {
    return await this.utmService.restore(Number(body.id), Number(userId))
  }

  /**
   * 重算单条累计统计（覆盖，不是累加）；恢复软删后用来补回被跳过的区间
   */
  @Post('recalc')
  async recalc(@Body() body: IRecalcUtmReq): Promise<IRecalcUtmRes> {
    return await this.utmService.recalcOne(Number(body.id))
  }

  /**
   * 全量初始化统计：把 ClickHouse 里已有的 UTM 全刷进统计表
   */
  @Post('stat/sync')
  async fullSync(@Body() body: IUtmStatSyncReq = {}): Promise<IUtmStatSyncRes> {
    return await this.utmService.fullSync(body || {})
  }

  /**
   * 增量统计：只统计游标之后到目标日的新增量
   */
  @Post('stat/increment')
  async incrementalSync(@Body() body: IUtmStatIncrementReq = {}): Promise<IUtmStatSyncRes> {
    return await this.utmService.incrementalSync(body || {})
  }

  /**
   * 查询统计游标
   */
  @Get('stat/cursor')
  async getCursor(): Promise<IUtmStatCursorRes> {
    return await this.utmService.getCursor()
  }
}
