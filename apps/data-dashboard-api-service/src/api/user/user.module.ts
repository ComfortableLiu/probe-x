import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { UserEntity } from "@entity/User.entity"
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { SsoAuthGuard } from "@src/api/user/SsoAuthGuard"
import { JwtStrategy } from "@src/api/user/JwtStrategy"
import { JwtAuthGuard } from "@src/api/user/JwtAuthGuard"

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    // TODO 这里需要改一下JWT的相关配置
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'defaultSecret',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '3600s',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UserController],
  providers: [UserService, JwtStrategy, JwtAuthGuard, SsoAuthGuard],
  exports: [UserService, JwtAuthGuard, SsoAuthGuard],
})
export class UserModule {
}
