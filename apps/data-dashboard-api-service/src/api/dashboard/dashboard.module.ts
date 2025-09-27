import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { EventEntity } from '@entity/event.entity'
import { ProcessedEventEntity } from '@entity/processed-event.entity'

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, ProcessedEventEntity])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
