import { Body, Controller, Post } from '@nestjs/common'
import {
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
import { UserPathAnalysisService } from "@src/api/data-analysis/user-path-analysis.service"

@Controller('/data-analysis')
export class DataAnalysisController {
  constructor(
    private readonly eventAnalysisService: EventAnalysisService,
    private readonly funnelAnalysisService: FunnelAnalysisService,
    private readonly userPathAnalysisService: UserPathAnalysisService,
  ) {
  }

  /**
   * 事件分析 - 查询数据任务
   */
  @Post('/event/query')
  async queryEvent(
    @Body() data: IEventAnalysisReq,
    @User() user: IUser,
  ): Promise<IEventAnalysisRes> {
    // TODO 后续查询数据可以写成异步的，用Redis存任务，可以节省上多线程充分利用资源
    const res = await this.eventAnalysisService.queryEvent(data)
    // TODO 这里可以调用Redis缓存一下，下次进来直接给就行
    return res
  }

  /**
   * 事件分析 - 创建数据下载
   */
  @Post('/event/download')
  async createDownloadTask(
    @Body() data: ISubmitDownloadTaskReq,
    @User() user: IUser,
  ): Promise<ISubmitDownloadTaskRes> {
    return await this.eventAnalysisService.createDownloadTask(data)
  }

  /**
   * 事件分析 - 查询下载数据任务进度
   */
  @Post('/event/download/task')
  async queryDownloadTask(
    @Body() data: IQueryDownloadTaskReq,
  ): Promise<IQueryDownloadTaskRes> {
    return await this.eventAnalysisService.queryDownloadTask(data.taskId)
  }

  /**
   * 漏斗分析 - 查询数据任务
   */
  @Post('/funnel/query')
  async queryFunnel(
    @Body() data: IFunnelAnalysisReq,
    @User() user: IUser,
  ) {
    // TODO 后续查询数据可以写成异步的，用Redis存任务，可以节省上多线程充分利用资源
    const res = await this.funnelAnalysisService.queryEvent({ ...data, funnelMode: 'strict' }) || []
    // TODO 这里可以调用Redis缓存一下，下次进来直接给就行
    return res
  }

  /**
   * 用户路径分析 - 查询数据任务
   */
  @Post('/user-path/query')
  async queryUserPath(
    @Body() data: IUserPathAnalysisReq,
    @User() user: IUser,
  ) {
    // TODO 后续查询数据可以写成异步的，用Redis存任务，可以节省上多线程充分利用资源
    const res = await this.userPathAnalysisService.queryEvent(data) || []
    // TODO 这里可以调用Redis缓存一下，下次进来直接给就行
    return res
  }
}
