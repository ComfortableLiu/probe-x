import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { ConfigModule } from '@nestjs/config'
import { JwtStrategy } from "./JwtStrategy"
import { JwtAuthGuard } from "./JwtAuthGuard"
import { AuthService } from "@src/service/auth.service"
import { JwtService } from "@nestjs/jwt"
import { Permission, Role, UserEntity, UserRoleRelation } from "@probe-x/shared-utils/src/lib/backend-common"
import { AdminGuard } from "../../guard/admin.guard"
import { PermissionGuard } from '../../guard/permission.guard'
import { AuthorizationService } from '../../service/authorization.service'

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserRoleRelation, Role, Permission]),
    ConfigModule,
  ],
  controllers: [UserController],
  providers: [UserService, AuthService, JwtStrategy, JwtAuthGuard, JwtService, AdminGuard, PermissionGuard, AuthorizationService],
  exports: [UserService, JwtAuthGuard, AdminGuard, PermissionGuard, AuthorizationService],
})
export class UserModule {
}
