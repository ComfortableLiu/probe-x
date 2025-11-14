import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataAnalysisController } from './data-analysis.controller'
import { UserModule } from '../user/user.module'
import { DataAnalysisService } from "./data-analysis.service"
import { ClickHouseModule } from "@probe-x/shared-utils/src/lib/backend-common"

@Module({
  imports: [
    TypeOrmModule.forFeature([]),
    UserModule,
    ClickHouseModule,
  ],
  controllers: [DataAnalysisController],
  providers: [DataAnalysisService],
  exports: [],
})
export class DataAnalysisModule {
}
