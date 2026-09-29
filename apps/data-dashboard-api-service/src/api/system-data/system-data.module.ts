import { ServiceResourcesService } from './service-resources.service'
import { RuntimeMetricsService } from './runtime-metrics.service'
import { RuntimeMetricsMiddleware } from './runtime-metrics.middleware'
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common'
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
  providers: [ServiceResourcesService, AnalysisService, MetaService, OverviewService, RuntimeMetricsService, RuntimeMetricsMiddleware],
  exports: [AnalysisService, MetaService, OverviewService],
})
export class SystemDataModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RuntimeMetricsMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL })
  }
}