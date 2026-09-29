import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { SystemConfigController } from './system-config.controller'
import { SystemConfigUserService } from './user.service'
import { SystemConfigRoleService } from './role.service'
import { SystemConfigSystemService } from './system.service'
import { GeneralConfigService } from './general-config.service'
import { UserEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/User.entity'
import { UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserRoleRelation.entity'
import { Role } from '@probe-x/shared-utils/src/lib/backend-common/entity/Role.entity'
import { Permission } from '@probe-x/shared-utils/src/lib/backend-common/entity/Permission.entity'
import { RolePermissionRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/RolePermissionRelation.entity'
import { System } from '@probe-x/shared-utils/src/lib/backend-common/entity/System.entity'
import { TrackingNodeEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/TrackingNode.entity'
import { SystemConfigEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/SystemConfig.entity'
import { ComputeNodeModule } from '../compute-node/compute-node.module'
import { AdminGuard } from '../../guard/admin.guard'

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserRoleRelation, Role, Permission, RolePermissionRelation, System, TrackingNodeEntity, SystemConfigEntity]),
    ConfigModule,
    ComputeNodeModule,
  ],
  controllers: [SystemConfigController],
  providers: [SystemConfigUserService, SystemConfigRoleService, SystemConfigSystemService, GeneralConfigService, AdminGuard],
  exports: [SystemConfigUserService, SystemConfigRoleService, SystemConfigSystemService, GeneralConfigService],
})
export class SystemConfigModule {}

