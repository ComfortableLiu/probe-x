import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import DatabaseModule from "./database/database.module";
import EnvConfigModule from "./database/env-config.module";
import { KafkaModule } from './kafka/kafka.module';
import { DataModule } from './api/data/data.module';
import { PointModule } from './api/point/point.module';
import { ResponseInterceptor } from "@src/interceptors/response.interceptor";
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: './config/env/.env',
    }),
    EnvConfigModule,
    DatabaseModule,
    KafkaModule,
    DataModule,
    PointModule,
  ],
  providers: [{
    provide: APP_INTERCEPTOR,
    useClass: ResponseInterceptor,
  }]
})
export class AppModule {
}
