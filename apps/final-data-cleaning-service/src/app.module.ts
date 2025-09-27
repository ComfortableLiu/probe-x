import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CleaningModule } from './cleaning/cleaning.module'
import { KafkaModule } from './kafka/kafka.module'
import { DatabaseModule } from './database/database.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: './config/env/.env',
    }),
    DatabaseModule,
    KafkaModule,
    CleaningModule,
  ],
})
export class AppModule {}
