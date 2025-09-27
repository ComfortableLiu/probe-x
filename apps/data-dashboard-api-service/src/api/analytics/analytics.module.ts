import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'
import { ProcessedEventEntity } from "@entity/processed-event.entity"
import { EventEntity } from "@entity/event.entity"

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, ProcessedEventEntity])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
