import { Module } from '@nestjs/common'
import { SystemDataController } from './system-data.controller'
import { SystemDataService } from './system-data.service'
import { ClickHouseModule } from '@probe-x/shared-utils/src/lib/backend-common'

@Module({
  imports: [
    ClickHouseModule,
  ],
  controllers: [SystemDataController],
  providers: [SystemDataService],
  exports: [SystemDataService],
})
export class SystemDataModule {
}
