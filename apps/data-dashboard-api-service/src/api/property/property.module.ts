import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { MetaEventEntity } from "@entity/MetaEvent.entity"
import { MetaPropertyEntity } from "@entity/MetaProperty.entity"
import { EventPropertyRelationEntity } from "@entity/EventPropertyRelation.entity"
import { UserModule } from "@src/api/user/user.module"
import { PropertyController } from "@src/api/property/property.controller"
import { PropertyService } from "@src/api/property/property.service"
import { ClickHouseModule } from "@probe-x/shared-utils/src/lib/backend-common"

@Module({
  imports: [
    TypeOrmModule.forFeature([MetaEventEntity, MetaPropertyEntity, EventPropertyRelationEntity]),
    UserModule,
    ClickHouseModule,
  ],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {
}
