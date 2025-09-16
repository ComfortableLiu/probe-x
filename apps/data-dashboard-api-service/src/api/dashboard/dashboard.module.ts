import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Event } from '../../entity/event.entity';
import { ProcessedEvent } from '../../entity/processed-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event, ProcessedEvent])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
