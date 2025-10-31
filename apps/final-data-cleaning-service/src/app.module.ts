import { Module } from '@nestjs/common'
import { ComputeNodeService } from "@src/service/node.service"
import { ClickHouseModule, envConfig, MysqlModule } from "@probe-x/shared-utils/src/lib/backend-common"
import configuration from "../config/configuration"

@Module({
  imports: [
    envConfig(configuration),
    MysqlModule.forRoot(),
    ClickHouseModule,
  ],
  providers: [ComputeNodeService],
})
export class AppModule {
}