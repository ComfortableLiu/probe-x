import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MetaEventEntity } from "@entity/MetaEvent.entity"
import { MetaPropertyEntity } from "@entity/MetaProperty.entity"
import { EventPropertyRelationEntity } from "@entity/EventPropertyRelation.entity"
import { UserEntity } from "@entity/User.entity"

const entities = [
  MetaEventEntity,
  MetaPropertyEntity,
  EventPropertyRelationEntity,
  UserEntity,
]

@Module({
  imports: [
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
          entities,
          synchronize: configService.get('NODE_ENV') === 'development',
          logging: configService.get('NODE_ENV') === 'development',
        }
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(entities),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {
}
