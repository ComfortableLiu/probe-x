import { DynamicModule, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule, ConfigService } from '@nestjs/config'
import * as entityModule from '../../entity'

// 动态获取所有实体类
function extractEntities(): any[] {
  const entities = []

  // 遍历entity模块的所有导出
  for (const key in entityModule) {
    const entity = entityModule[key]
    // 检查是否为类定义
    if (entity &&
      typeof entity === 'function' &&
      entity.name &&
      typeof entity.name === 'string' &&
      entity.prototype) {
      // 排除非实体类（如ResponseData）
      if (key !== 'ResponseData') {
        entities.push(entity)
      }
    }
  }

  return entities
}

const allEntities = extractEntities()

console.log('l--==-=-=-', allEntities)

@Module({
  exports: [TypeOrmModule],
})
export class MysqlModule {
  static forRoot(additionalEntities?: any[]): DynamicModule {
    console.log('lll--l==l-=l', additionalEntities)
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
              entities: [...allEntities, ...(additionalEntities || [])],
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
