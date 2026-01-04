import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { SystemConfigController } from './system-config.controller'
import { SystemConfigUserService } from './user.service'
import { Role, UserEntity, UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common'

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserRoleRelation, Role]),
    ConfigModule,
  ],
  controllers: [SystemConfigController],
  providers: [SystemConfigUserService],
  exports: [SystemConfigUserService],
})
export class SystemConfigModule {}

