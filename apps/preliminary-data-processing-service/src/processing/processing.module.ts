import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessingController } from './processing.controller';
import { ProcessingService } from './processing.service';
import { Event } from '../entity/event.entity';
import { ProcessedEvent } from '../entity/processed-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event, ProcessedEvent])],
  controllers: [ProcessingController],
  providers: [ProcessingService],
  exports: [ProcessingService],
})
export class ProcessingModule {}
