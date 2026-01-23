import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import {
  DashboardEntity,
  UserRoleRelation,
  Role,
  ClickHouseModule,
} from '@probe-x/shared-utils/src/lib/backend-common'
import { DataAnalysisModule } from '../data-analysis/data-analysis.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([DashboardEntity, UserRoleRelation, Role]),
    forwardRef(() => DataAnalysisModule),
    ClickHouseModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
