import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ClickHouseService } from './clickhouse.service'
import { ClickHouseProvider } from "../../provider/clickhouse.provider"

@Module({
  imports: [ConfigModule],
  providers: [ClickHouseProvider, ClickHouseService],
  exports: [ClickHouseService],
})
export class ClickHouseModule {}
