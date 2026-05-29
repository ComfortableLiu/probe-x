import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSourceEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/DataSource.entity'
import { DataSourceController } from './datasource.controller'
import { DataSourceService } from './datasource.service'

@Module({
  imports: [TypeOrmModule.forFeature([DataSourceEntity])],
  controllers: [DataSourceController],
  providers: [DataSourceService],
  exports: [DataSourceService],
})
export class DataSourceModule {}
