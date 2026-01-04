import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { SystemConfigController } from './system-config.controller'
import { SystemConfigUserService } from './user.service'
import { SystemConfigRoleService } from './role.service'
import { Role, UserEntity, UserRoleRelation, Permission, RolePermissionRelation } from '@probe-x/shared-utils/src/lib/backend-common'

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserRoleRelation, Role, Permission, RolePermissionRelation]),
    ConfigModule,
  ],
  controllers: [SystemConfigController],
  providers: [SystemConfigUserService, SystemConfigRoleService],
  exports: [SystemConfigUserService, SystemConfigRoleService],
})
export class SystemConfigModule {}

