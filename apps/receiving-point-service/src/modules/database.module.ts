import { ConfigModule, ConfigService } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"

const entities = [
]

export default TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'mysql',
    host: config.get<string>('database.host'),
    port: config.get<number>('database.port'),
    username: config.get<string>('database.username'),
    password: config.get<string>('database.password'),
    database: config.get<string>('database.database'),
    entities,
    synchronize: config.get<boolean>('database.synchronize'),
  }),
})
