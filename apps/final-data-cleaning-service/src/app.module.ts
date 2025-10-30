import { Module } from '@nestjs/common'
import { ComputeNodeService } from "@src/service/node.service"
import { envConfig, MysqlModule } from "@probe-x/shared-utils/src/lib/backend-common"
import configuration from "../config/configuration"

@Module({
  imports: [
    envConfig(configuration),
    MysqlModule.forRoot(),
  ],
  providers: [ComputeNodeService],
})
export class AppModule {
}