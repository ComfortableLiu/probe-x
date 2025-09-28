import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EventController } from './event.controller'
import { EventService } from './event.service'
import { MetaEventEntity } from "@entity/MetaEvent.entity"
import { MetaPropertyEntity } from "@entity/MetaProperty.entity"
import { EventPropertyRelationEntity } from "@entity/EventPropertyRelation.entity"

@Module({
  imports: [TypeOrmModule.forFeature([MetaEventEntity, MetaPropertyEntity, EventPropertyRelationEntity])],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {
}
