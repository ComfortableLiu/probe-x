import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { ConfigModule } from '@nestjs/config'
import { JwtStrategy } from "./JwtStrategy"
import { JwtAuthGuard } from "./JwtAuthGuard"
import { AuthService } from "@src/service/auth.service"
import { JwtService } from "@nestjs/jwt"
import { Permission, Role, UserEntity, UserRoleRelation } from "@probe-x/shared-utils/src/lib/backend-common"

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserRoleRelation, Role, Permission]),
    ConfigModule,
  ],
  controllers: [UserController],
  providers: [UserService, AuthService, JwtStrategy, JwtAuthGuard, JwtService],
  exports: [UserService, JwtAuthGuard],
})
export class UserModule {
}
