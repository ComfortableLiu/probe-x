import { Injectable } from '@nestjs/common'
import { DimensionLayer, IEventAnalysisReq } from "@probe-x/shared-types/src"
import { ClickHouseService } from "@probe-x/shared-utils/src/lib/backend-common"
import { eventAnalysisSqlBuilder } from "@src/api/data-analysis/EventAnalysisSqlBuilder"

@Injectable()
export class DataAnalysisService {
  constructor(
    private clickhouseService: ClickHouseService,
  ) {
  }

  async queryEvent(data: IEventAnalysisReq): Promise<DimensionLayer> {
    // 拼接SQL语句
    const { sql, params } = eventAnalysisSqlBuilder.buildSql(data)

    const result = await this.clickhouseService.query<DimensionLayer>(sql, params)

    console.log(result)
    return result[0]
  }
}
