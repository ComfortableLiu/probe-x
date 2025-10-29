import { Module } from '@nestjs/common'
import { CleaningModule } from './cleaning/cleaning.module'
import { envConfig, KafkaModule, MysqlModule } from "@probe-x/shared-utils/src/lib/backend-common"
import configuration from "../config/configuration"

@Module({
  imports: [
    envConfig(configuration),
    MysqlModule.forRoot(),
    KafkaModule,
    CleaningModule,
  ],
})
export class AppModule {}
