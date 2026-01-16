import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { SystemConfigController } from './system-config.controller'
import { SystemConfigUserService } from './user.service'
import { SystemConfigRoleService } from './role.service'
import { SystemConfigSystemService } from './system.service'
import { UserEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/User.entity'
import { UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserRoleRelation.entity'
import { Role } from '@probe-x/shared-utils/src/lib/backend-common/entity/Role.entity'
import { Permission } from '@probe-x/shared-utils/src/lib/backend-common/entity/Permission.entity'
import { RolePermissionRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/RolePermissionRelation.entity'
import { System } from '@probe-x/shared-utils/src/lib/backend-common/entity/System.entity'
import { TrackingNodeEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/TrackingNode.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserRoleRelation, Role, Permission, RolePermissionRelation, System, TrackingNodeEntity]),
    ConfigModule,
  ],
  controllers: [SystemConfigController],
  providers: [SystemConfigUserService, SystemConfigRoleService, SystemConfigSystemService],
  exports: [SystemConfigUserService, SystemConfigRoleService, SystemConfigSystemService],
})
export class SystemConfigModule {}

