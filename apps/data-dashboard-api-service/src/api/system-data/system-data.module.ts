import { Module } from '@nestjs/common'
import { SystemDataController } from './system-data.controller'
import { AnalysisService } from './analysis.service'
import { MetaService } from './meta.service'
import { OverviewService } from './overview.service'
import { ComputeNodeModule } from '../compute-node/compute-node.module'
import {
  ClickHouseModule,
  DataAnalysisAccessStatsEntity,
  DataAnalysisExportLogEntity,
  DataAnalysisQueryStatsEntity,
  DataAnalysisTaskLogEntity,
} from '@probe-x/shared-utils/src/lib/backend-common'
import { TypeOrmModule } from '@nestjs/typeorm'

@Module({
  imports: [
    ClickHouseModule,
    ComputeNodeModule,
    TypeOrmModule.forFeature([
      DataAnalysisTaskLogEntity,
      DataAnalysisQueryStatsEntity,
      DataAnalysisExportLogEntity,
      DataAnalysisAccessStatsEntity,
    ]),
  ],
  controllers: [SystemDataController],
  providers: [AnalysisService, MetaService, OverviewService],
  exports: [AnalysisService, MetaService, OverviewService],
})
export class SystemDataModule {
}