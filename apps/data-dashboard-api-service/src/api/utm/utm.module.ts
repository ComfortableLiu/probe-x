import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bullmq'
import { ClickHouseModule, SyncCursorEntity, UtmItemEntity } from '@probe-x/shared-utils/src/lib/backend-common'
import { UtmController } from './utm.controller'
import { UtmService } from './utm.service'
import { UtmProcessor } from './utm.processor'
import { QUEUE_NAME } from './type'

@Module({
  imports: [
    TypeOrmModule.forFeature([UtmItemEntity, SyncCursorEntity]),
    ClickHouseModule,
    BullModule.registerQueue({ name: QUEUE_NAME }),
  ],
  controllers: [UtmController],
  providers: [UtmService, UtmProcessor],
  // 未来的 UTM 分析通过 getIgnoredValues() 拿到已删除取值，避免统计进分析
  exports: [UtmService],
})
export class UtmModule {
}
