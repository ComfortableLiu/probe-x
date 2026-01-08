import { Body, Controller, Post, Req } from '@nestjs/common'
import {
  IAttributionAnalysisReq,
  IEventAnalysisReq,
  IEventAnalysisRes,
  IFunnelAnalysisReq,
  IQueryDownloadTaskReq,
  IQueryDownloadTaskRes,
  ISubmitDownloadTaskReq,
  ISubmitDownloadTaskRes,
  IUser,
  IUserPathAnalysisReq,
} from "@probe-x/shared-types/src"
import { User } from "@probe-x/shared-utils/src/lib/backend-common"
import { EventAnalysisService } from "./event-analysis.service"
import { FunnelAnalysisService } from "./funnel-analysis.service"
import { UserPathAnalysisService } from "./user-path-analysis.service"
import { AttributionAnalysisService } from "./attribution-analysis.service"
import { DataAnalysisRecordService } from "./record.service"
import { Request } from 'express'

@Controller('/data-analysis')
export class DataAnalysisController {
  constructor(
    private readonly eventAnalysisService: EventAnalysisService,
    private readonly funnelAnalysisService: FunnelAnalysisService,
    private readonly userPathAnalysisService: UserPathAnalysisService,
    private readonly attributionAnalysisService: AttributionAnalysisService,
    private readonly dataAnalysisRecordService: DataAnalysisRecordService,
  ) {
  }

  /**
   * 事件分析 - 查询数据任务
   */
  @Post('/event/query')
  async queryEvent(
    @Body() data: IEventAnalysisReq,
    @User() user: IUser,
    @Req() req: Request,
  ): Promise<IEventAnalysisRes> {
    // 记录访问日志
    await this.dataAnalysisRecordService.recordAccess(user, 'api_call', '/data-analysis/event/query', req.ip, req.get('User-Agent') || undefined)

    // 记录查询日志
    const startTime = Date.now()
    try {
      const res = await this.eventAnalysisService.queryEvent(data, user)
      const duration = Date.now() - startTime
      await this.dataAnalysisRecordService.recordQuery(user, JSON.stringify(data), duration, Array.isArray(res) ? res.length : 0, true)
      // TODO 这里可以调用Redis缓存一下，下次进来直接给就行
      return res
    } catch (error) {
      const duration = Date.now() - startTime
      await this.dataAnalysisRecordService.recordQuery(user, JSON.stringify(data), duration, 0, false, error.message)
      throw error
    }
  }

  /**
   * 事件分析 - 创建数据下载
   */
  @Post('/event/download')
  async createDownloadTask(
    @Body() data: ISubmitDownloadTaskReq,
    @User() user: IUser,
    @Req() req: Request,
  ): Promise<ISubmitDownloadTaskRes> {
    // 记录访问日志
    await this.dataAnalysisRecordService.recordAccess(user, 'api_call', '/data-analysis/event/download', req.ip, req.get('User-Agent') || undefined)

    const res = await this.eventAnalysisService.createDownloadTask(data, user)
    // 记录导出日志
    await this.dataAnalysisRecordService.recordExport(user, 'excel', '事件分析数据导出', data)
    return res
  }

  /**
   * 事件分析 - 查询下载数据任务进度
   */
  @Post('/event/download/task')
  async queryDownloadTask(
    @Body() data: IQueryDownloadTaskReq,
    @User() user: IUser,
    @Req() req: Request,
  ): Promise<IQueryDownloadTaskRes> {
    // 记录访问日志
    await this.dataAnalysisRecordService.recordAccess(user, 'api_call', '/data-analysis/event/download/task', req.ip, req.get('User-Agent') || undefined)

    return await this.eventAnalysisService.queryDownloadTask(data.taskId)
  }

  /**
   * 漏斗分析 - 查询数据任务
   */
  @Post('/funnel/query')
  async queryFunnel(
    @Body() data: IFunnelAnalysisReq,
    @User() user: IUser,
    @Req() req: Request,
  ) {
    // 记录访问日志
    await this.dataAnalysisRecordService.recordAccess(user, 'api_call', '/data-analysis/funnel/query', req.ip, req.get('User-Agent') || undefined)

    // 记录查询日志
    const startTime = Date.now()
    try {
      const res = await this.funnelAnalysisService.queryEvent(data, user)
      const duration = Date.now() - startTime
      await this.dataAnalysisRecordService.recordQuery(user, JSON.stringify(data), duration, Array.isArray(res) ? res.length : 0, true)
      // TODO 这里可以调用Redis缓存一下，下次进来直接给就行
      return res
    } catch (error) {
      const duration = Date.now() - startTime
      await this.dataAnalysisRecordService.recordQuery(user, JSON.stringify(data), duration, 0, false, error.message)
      throw error
    }
  }

  /**
   * 漏斗分析 - 创建数据下载
   */
  @Post('/funnel/download')
  async createFunnelDownloadTask(
    @Body() data: ISubmitDownloadTaskReq,
    @User() user: IUser,
    @Req() req: Request,
  ): Promise<ISubmitDownloadTaskRes> {
    // 记录访问日志
    await this.dataAnalysisRecordService.recordAccess(user, 'api_call', '/data-analysis/funnel/download', req.ip, req.get('User-Agent') || undefined)

    const res = await this.funnelAnalysisService.createDownloadTask(data, user)
    // 记录导出日志
    await this.dataAnalysisRecordService.recordExport(user, 'excel', '漏斗分析数据导出', data)
    return res
  }

  /**
   * 漏斗分析 - 查询下载数据任务进度
   */
  @Post('/funnel/download/task')
  async queryFunnelDownloadTask(
    @Body() data: IQueryDownloadTaskReq,
    @User() user: IUser,
    @Req() req: Request,
  ): Promise<IQueryDownloadTaskRes> {
    // 记录访问日志
    await this.dataAnalysisRecordService.recordAccess(user, 'api_call', '/data-analysis/funnel/download/task', req.ip, req.get('User-Agent') || undefined)

    return await this.funnelAnalysisService.queryDownloadTask(data.taskId)
  }

  /**
   * 用户路径分析 - 查询数据任务
   */
  @Post('/user-path/query')
  async queryUserPath(
    @Body() data: IUserPathAnalysisReq,
    @User() user: IUser,
    @Req() req: Request,
  ) {
    // 记录访问日志
    await this.dataAnalysisRecordService.recordAccess(user, 'api_call', '/data-analysis/user-path/query', req.ip, req.get('User-Agent') || undefined)

    // 记录查询日志
    const startTime = Date.now()
    try {
      const res = await this.userPathAnalysisService.queryEvent(data, user)
      const duration = Date.now() - startTime
      await this.dataAnalysisRecordService.recordQuery(user, JSON.stringify(data), duration, JSON.stringify(res).length, true)
      // TODO 这里可以调用Redis缓存一下，下次进来直接给就行
      return res
    } catch (error) {
      const duration = Date.now() - startTime
      await this.dataAnalysisRecordService.recordQuery(user, JSON.stringify(data), duration, 0, false, error.message)
      throw error
    }
  }

  /**
   * 用户路径分析 - 创建数据下载
   */
  @Post('/user-path/download')
  async createUserPathDownloadTask(
    @Body() data: ISubmitDownloadTaskReq,
    @User() user: IUser,
    @Req() req: Request,
  ): Promise<ISubmitDownloadTaskRes> {
    // 记录访问日志
    await this.dataAnalysisRecordService.recordAccess(user, 'api_call', '/data-analysis/user-path/download', req.ip, req.get('User-Agent') || undefined)

    const res = await this.userPathAnalysisService.createDownloadTask(data, user)
    // 记录导出日志
    await this.dataAnalysisRecordService.recordExport(user, 'excel', '用户路径分析数据导出', data)
    return res
  }

  /**
   * 用户路径分析 - 查询下载数据任务进度
   */
  @Post('/user-path/download/task')
  async queryUserPathDownloadTask(
    @Body() data: IQueryDownloadTaskReq,
    @User() user: IUser,
    @Req() req: Request,
  ): Promise<IQueryDownloadTaskRes> {
    // 记录访问日志
    await this.dataAnalysisRecordService.recordAccess(user, 'api_call', '/data-analysis/user-path/download/task', req.ip, req.get('User-Agent') || undefined)

    return await this.userPathAnalysisService.queryDownloadTask(data.taskId)
  }

  /**
   * 归因分析 - 查询数据任务
   */
  @Post('/attribution/query')
  async queryAttribution(
    @Body() data: IAttributionAnalysisReq,
    @User() user: IUser,
    @Req() req: Request,
  ) {
    // 记录访问日志
    await this.dataAnalysisRecordService.recordAccess(user, 'api_call', '/data-analysis/attribution/query', req.ip, req.get('User-Agent') || undefined)

    // 记录查询日志
    const startTime = Date.now()
    try {
      const res = await this.attributionAnalysisService.queryEvent(data, user)
      const duration = Date.now() - startTime
      await this.dataAnalysisRecordService.recordQuery(user, JSON.stringify(data), duration, JSON.stringify(res).length, true)
      // TODO 这里可以调用Redis缓存一下，下次进来直接给就行
      return res
    } catch (error) {
      const duration = Date.now() - startTime
      await this.dataAnalysisRecordService.recordQuery(user, JSON.stringify(data), duration, 0, false, error.message)
      throw error
    }
  }

  /**
   * 归因分析 - 创建数据下载
   */
  @Post('/attribution/download')
  async createAttributionDownloadTask(
    @Body() data: ISubmitDownloadTaskReq,
    @User() user: IUser,
    @Req() req: Request,
  ): Promise<ISubmitDownloadTaskRes> {
    // 记录访问日志
    await this.dataAnalysisRecordService.recordAccess(user, 'api_call', '/data-analysis/attribution/download', req.ip, req.get('User-Agent') || undefined)

    const res = await this.attributionAnalysisService.createDownloadTask(data, user)
    // 记录导出日志
    await this.dataAnalysisRecordService.recordExport(user, 'excel', '归因分析数据导出', data)
    return res
  }

  /**
   * 归因分析 - 查询下载数据任务进度
   */
  @Post('/attribution/download/task')
  async queryAttributionDownloadTask(
    @Body() data: IQueryDownloadTaskReq,
    @User() user: IUser,
    @Req() req: Request,
  ): Promise<IQueryDownloadTaskRes> {
    // 记录访问日志
    await this.dataAnalysisRecordService.recordAccess(user, 'api_call', '/data-analysis/attribution/download/task', req.ip, req.get('User-Agent') || undefined)

    return await this.attributionAnalysisService.queryDownloadTask(data.taskId)
  }
}
