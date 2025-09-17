import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProcessingModule } from './processing/processing.module';
import { KafkaModule } from './kafka/kafka.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: './config/env/.env',
    }),
    DatabaseModule,
    KafkaModule,
    ProcessingModule,
  ],
})
export class AppModule {}
