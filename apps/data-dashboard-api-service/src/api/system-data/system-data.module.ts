import { Module } from '@nestjs/common'
import { SystemDataController } from './system-data.controller'
import { AnalysisService } from './analysis.service'
import { MetaService } from './meta.service'
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
    TypeOrmModule.forFeature([
      DataAnalysisTaskLogEntity,
      DataAnalysisQueryStatsEntity,
      DataAnalysisExportLogEntity,
      DataAnalysisAccessStatsEntity,
    ]),
  ],
  controllers: [SystemDataController],
  providers: [AnalysisService, MetaService],
  exports: [AnalysisService, MetaService],
})
export class SystemDataModule {
}
