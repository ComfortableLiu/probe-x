import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointController } from './point.controller';
import { PointService } from './point.service';
import { Event } from '@entity/event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event])],
  controllers: [PointController],
  providers: [PointService],
})
export class PointModule {}
