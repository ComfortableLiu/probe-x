import { Injectable } from '@nestjs/common'
import { IFunnelAnalysisReq, IFunnelAnalysisRes } from "@probe-x/shared-types/src"
import { ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { QUEUE_NAME } from "@src/api/data-analysis/type"
import { InjectQueue } from "@nestjs/bullmq"
import { Queue } from "bullmq"
import { generateFunnelAnalysisSql } from "./FunnelAnalysisSqlBuilder"

@Injectable()
export class FunnelAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
    @InjectQueue(QUEUE_NAME)
    private readonly exportQueue: Queue,
  ) {
  }

  async queryEvent(data: IFunnelAnalysisReq): Promise<IFunnelAnalysisRes> {
    // 拼接SQL语句
    const { sql, params, error } = generateFunnelAnalysisSql(data)

    // console.log('SQL语句：', sql)
    // console.log('SQL参数：', params)
    // console.log('SQL错误：', error)

    // const result = [
    //   {
    //     "$device": "rwr",
    //     "1111": 217,  // 步骤1（stepName="1111"，page_leave事件）符合条件的事件数
    //     "2": 132,      // 步骤2（stepName="2"，page_load事件+device_id=12312+duration=323）且跟随步骤1的事件数
    //     "3333": 89,     // 步骤3（stepName="3333"，page_view事件）且跟随步骤2的事件数
    //   },
    // ]
    const result = await this.clickhouseService.query<any>(sql, params)
    // console.log('数据查询结果：', result)
    return result
  }
}
