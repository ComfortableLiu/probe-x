import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { UserModule } from "@src/api/user/user.module"
import { PropertyController } from "@src/api/property/property.controller"
import { PropertyService } from "@src/api/property/property.service"
import {
  ClickHouseModule,
  EventPropertyRelationEntity,
  MetaEventEntity,
  MetaPropertyEntity,
  Role,
  UserRoleRelation,
} from "@probe-x/shared-utils/src/lib/backend-common"
import { AdminGuard } from "../../guard/admin.guard"

@Module({
  imports: [
    TypeOrmModule.forFeature([MetaEventEntity, MetaPropertyEntity, EventPropertyRelationEntity, UserRoleRelation, Role]),
    UserModule,
    ClickHouseModule,
  ],
  controllers: [PropertyController],
  providers: [PropertyService, AdminGuard],
  exports: [PropertyService],
})
export class PropertyModule {
}
