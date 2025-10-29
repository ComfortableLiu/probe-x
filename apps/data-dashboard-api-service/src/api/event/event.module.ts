import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EventController } from './event.controller'
import { EventService } from './event.service'
import { UserModule } from '../user/user.module'
import {
  EventPropertyRelationEntity,
  MetaEventEntity,
  MetaPropertyEntity,
} from "@probe-x/shared-utils/src/lib/backend-common"

@Module({
  imports: [
    TypeOrmModule.forFeature([MetaEventEntity, MetaPropertyEntity, EventPropertyRelationEntity]),
    UserModule,
  ],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {
}
