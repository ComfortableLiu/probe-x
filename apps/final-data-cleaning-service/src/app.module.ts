import { Module } from '@nestjs/common'
import { CleaningModule } from './cleaning/cleaning.module'
import { envConfig, KafkaModule } from "@probe-x/shared-utils/src/lib/backend-common"
import { DatabaseModule } from './database/database.module'
import configuration from "../config/configuration"

@Module({
  imports: [
    envConfig(configuration),
    DatabaseModule,
    KafkaModule,
    CleaningModule,
  ],
})
export class AppModule {}
