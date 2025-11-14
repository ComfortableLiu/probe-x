import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataAnalysisController } from './data-analysis.controller'
import { UserModule } from '../user/user.module'
import { DataAnalysisService } from "./data-analysis.service"
import { ClickHouseModule, MinIOModule } from "@probe-x/shared-utils/src/lib/backend-common"
import { BullModule } from "@nestjs/bullmq"
import { QUEUE_NAME } from "@src/api/data-analysis/type"

@Module({
  imports: [
    TypeOrmModule.forFeature([]),
    UserModule,
    ClickHouseModule,
    BullModule.registerQueue({ name: QUEUE_NAME }),
    MinIOModule,
  ],
  controllers: [DataAnalysisController],
  providers: [DataAnalysisService],
  exports: [],
})
export class DataAnalysisModule {
}
