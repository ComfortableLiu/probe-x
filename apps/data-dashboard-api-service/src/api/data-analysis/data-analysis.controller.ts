import { Body, Controller, Post } from '@nestjs/common'
import { DataAnalysisService } from './data-analysis.service'
import { UserService } from "../user/user.service"
import type { IEventAnalysisReq, IUser } from "@probe-x/shared-types/src"
import { User } from "@probe-x/shared-utils/src/lib/backend-common"

@Controller('/data-analysis')
export class DataAnalysisController {
  constructor(
    private readonly dataAnalysisService: DataAnalysisService,
    private readonly userService: UserService,
  ) {
  }

  /**
   * 查询数据任务
   */
  @Post('/event/query')
  async queryEvent(
    @Body() data: IEventAnalysisReq,
    @User() user: IUser,
  ) {
    // TODO 后续查询数据可以写成异步的，用Redis存任务，可以节省上多线程充分利用资源
    const res = await this.dataAnalysisService.queryEvent(data)
    // TODO 这里可以调用Redis缓存一下，下次进来直接给就行
    return res
  }
}
