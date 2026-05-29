import { Module } from '@nestjs/common'
import { ClickHouseModule } from '@probe-x/shared-utils/src/lib/backend-common'
import { HomepageController } from './homepage.controller'
import { HomepageService } from './homepage.service'

@Module({
  imports: [ClickHouseModule],
  controllers: [HomepageController],
  providers: [HomepageService],
  exports: [HomepageService],
})
export class HomepageModule {}
