import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataAnalysisController } from './data-analysis.controller'
import { UserModule } from '../user/user.module'
import { ClickHouseModule, MinIOModule } from "@probe-x/shared-utils/src/lib/backend-common"
import { BullModule } from "@nestjs/bullmq"
import { QUEUE_NAME } from "@src/api/data-analysis/type"
import { QueryDownloadQueueProcessor } from "@src/api/data-analysis/query-download-queue.processor"
import { EventAnalysisService } from "./event-analysis.service"
import { FunnelAnalysisService } from "./funnel-analysis.service"
import { UserPathAnalysisService } from "./user-path-analysis.service"
import { AttributionAnalysisService } from "./attribution-analysis.service"
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
  ],
  controllers: [DataAnalysisController],
  providers: [EventAnalysisService, FunnelAnalysisService, UserPathAnalysisService, AttributionAnalysisService, QueryDownloadQueueProcessor, DataAnalysisRecordService],
  exports: [DataAnalysisRecordService, EventAnalysisService, FunnelAnalysisService, UserPathAnalysisService, AttributionAnalysisService],
})
export class DataAnalysisModule {
}