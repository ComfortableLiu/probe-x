import { Injectable } from '@nestjs/common'
import { GenericEventAnalysisResult, IFunnelAnalysisReq } from "@probe-x/shared-types/src"
import { ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { QUEUE_NAME } from "@src/api/data-analysis/type"
import { InjectQueue } from "@nestjs/bullmq"
import { Queue } from "bullmq"
import { generateEventAnalysisSql } from "@src/api/data-analysis/FunnelAnalysisSqlBuilder"

@Injectable()
export class FunnelAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
    @InjectQueue(QUEUE_NAME)
    private readonly exportQueue: Queue,
  ) {
  }

  async queryEvent(data: IFunnelAnalysisReq): Promise<GenericEventAnalysisResult[]> {
    // 拼接SQL语句
    const { sql, params, error } = generateEventAnalysisSql(data)
    //
    // console.log('SQL语句：', sql)
    // console.log('SQL参数：', params)

    const result = await this.clickhouseService.query<GenericEventAnalysisResult[]>(sql, params)

    console.log('数据查询结果：', result)
    return result[0]
  }
}
