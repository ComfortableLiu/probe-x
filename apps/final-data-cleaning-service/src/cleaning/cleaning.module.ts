import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CleaningController } from './cleaning.controller'
import { CleaningService } from './cleaning.service'
import { ProcessedEvent } from '../entity/processed-event'
import { CleanedEvent } from '../entity/cleaned-event'

@Module({
  imports: [TypeOrmModule.forFeature([ProcessedEvent, CleanedEvent])],
  controllers: [CleaningController],
  providers: [CleaningService],
  exports: [CleaningService],
})
export class CleaningModule {}
