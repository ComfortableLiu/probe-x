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
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_DATABASE', 'probe_x'),
        entities: [MetaEventEntity, MetaPropertyEntity, EventPropertyRelationEntity],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(entities),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {
}
