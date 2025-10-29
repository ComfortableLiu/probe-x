import { DynamicModule, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule, ConfigService } from '@nestjs/config'
import {
  EventPropertyRelationEntity,
  MetaEventEntity,
  MetaPropertyEntity,
  Permission,
  Role,
  RolePermissionRelation,
  TrackingNodeEntity,
  UserEntity,
  UserRoleRelation,
} from "../../entity"

const baseEntities = [
  MetaEventEntity,
  MetaPropertyEntity,
  EventPropertyRelationEntity,
  UserEntity,
  Role,
  UserRoleRelation,
  Permission,
  RolePermissionRelation,
  TrackingNodeEntity,
]

@Module({
  exports: [TypeOrmModule],
})
export class MysqlModule {
  static forRoot(entities?: any[]): DynamicModule {
    return {
      module: MysqlModule,
      imports: [
        ConfigModule,
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => {
            return {
              type: 'mysql',
              host: configService.get('database.host', 'localhost'),
              port: configService.get('database.port', 3306),
              username: configService.get('database.username', 'root'),
              password: configService.get('database.password', ''),
              database: configService.get('database.database', 'probe_x'),
              entities: [...baseEntities, ...(entities || [])],
              synchronize: configService.get('database.synchronize'),
              logging: configService.get('NODE_ENV') === 'development',
            }
          },
          inject: [ConfigService],
        }),
      ],
      exports: [],
    }
  }
}
