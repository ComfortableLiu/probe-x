import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CleaningModule } from './cleaning/cleaning.module';
import { KafkaModule } from './kafka/kafka.module';
import { DatabaseModule } from './database/database.module';
import { ProcessedEvent } from './entity/processed-event.entity';
import { CleanedEvent } from './entity/cleaned-event.entity';

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
