import { Module } from '@nestjs/common'
import { PointController } from './point.controller'
import { PointService } from './point.service'

@Module({
  imports: [],
  controllers: [PointController],
  providers: [PointService],
})
export class PointModule {
}
