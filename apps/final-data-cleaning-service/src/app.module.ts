import { Module } from '@nestjs/common'
import { ComputeNodeService } from "@src/service/node.service"
import { ClickHouseModule, envConfig, MysqlModule, RedisModule } from "@probe-x/shared-utils/src/lib/backend-common"
import configuration from "../config/configuration"

@Module({
  imports: [
    envConfig(configuration, 'apps/final-data-cleaning-service'),
    MysqlModule.forRoot(),
    ClickHouseModule,
    RedisModule.forRoot(),
  ],
  providers: [ComputeNodeService],
})
export class AppModule {
}