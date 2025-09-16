import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataController } from './data.controller';
import { DataService } from './data.service';
import { Event } from '../../entity/event.entity';
import { KafkaModule } from '../../kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event]),
    KafkaModule,
  ],
  controllers: [DataController],
  providers: [DataService],
  exports: [DataService],
})
export class DataModule {}
