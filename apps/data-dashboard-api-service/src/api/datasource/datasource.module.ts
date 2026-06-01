import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSourceEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/DataSource.entity'
import { UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserRoleRelation.entity'
import { Role } from '@probe-x/shared-utils/src/lib/backend-common/entity/Role.entity'
import { DataSourceController } from './datasource.controller'
import { DataSourceService } from './datasource.service'
import { AdminGuard } from '../../guard/admin.guard'

@Module({
  imports: [TypeOrmModule.forFeature([DataSourceEntity, UserRoleRelation, Role])],
  controllers: [DataSourceController],
  providers: [DataSourceService, AdminGuard],
  exports: [DataSourceService],
})
export class DataSourceModule {}
