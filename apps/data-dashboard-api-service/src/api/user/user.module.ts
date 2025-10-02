import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { UserEntity } from "@entity/User.entity"
import { JwtStrategy } from "./JwtStrategy"
import { JwtAuthGuard } from "./JwtAuthGuard"
import { SsoAuthGuard } from "./SsoAuthGuard"
import { AuthService } from "@src/service/auth.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') || 'defaultSecret',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UserController],
  providers: [UserService, AuthService, JwtStrategy, JwtAuthGuard, SsoAuthGuard],
  exports: [UserService, JwtAuthGuard, SsoAuthGuard],
})
export class UserModule {
}
