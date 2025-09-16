import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Event } from '../../entity/event.entity';
import { ProcessedEvent } from '../../entity/processed-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event, ProcessedEvent])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
