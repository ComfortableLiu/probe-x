import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataAnalysisController } from './data-analysis.controller'
import { UserModule } from '../user/user.module'
import { ClickHouseModule, MinIOModule } from "@probe-x/shared-utils/src/lib/backend-common"
import { BullModule } from "@nestjs/bullmq"
import { QUEUE_NAME } from "@src/api/data-analysis/type"
import { QueryDownloadQueueProcessor } from "@src/api/data-analysis/query-download-queue.processor"
import { UtmModule } from "@src/api/utm/utm.module"
import { EventAnalysisService } from "./event-analysis.service"
import { FunnelAnalysisService } from "./funnel-analysis.service"
import { UserPathAnalysisService } from "./user-path-analysis.service"
import { AttributionAnalysisService } from "./attribution-analysis.service"
import { RetentionAnalysisService } from "./retention-analysis.service"
import { UserSegmentationService } from "./user-segmentation.service"
import { SqlAnalysisService } from "./sql-analysis.service"
import { UtmAnalysisService } from "./utm-analysis.service"
import { DataAnalysisRecordService } from "./record.service"
import {
  DataAnalysisAccessStatsEntity,
  DataAnalysisExportLogEntity,
  DataAnalysisQueryStatsEntity,
  DataAnalysisTaskLogEntity,
} from "@probe-x/shared-utils/src/lib/backend-common"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DataAnalysisTaskLogEntity,
      DataAnalysisQueryStatsEntity,
      DataAnalysisExportLogEntity,
      DataAnalysisAccessStatsEntity,
    ]),
    UserModule,
    ClickHouseModule,
    BullModule.registerQueue({ name: QUEUE_NAME }),
    MinIOModule,
    // UTM 分析要拿软删取值清单，拼 NOT IN 把删掉的 UTM 从统计里排除
    UtmModule,
  ],
  controllers: [DataAnalysisController],
  providers: [EventAnalysisService, FunnelAnalysisService, UserPathAnalysisService, AttributionAnalysisService, RetentionAnalysisService, UserSegmentationService, SqlAnalysisService, UtmAnalysisService, QueryDownloadQueueProcessor, DataAnalysisRecordService],
  exports: [DataAnalysisRecordService, EventAnalysisService, FunnelAnalysisService, UserPathAnalysisService, AttributionAnalysisService, RetentionAnalysisService, UserSegmentationService, SqlAnalysisService, UtmAnalysisService],
})
export class DataAnalysisModule {
}