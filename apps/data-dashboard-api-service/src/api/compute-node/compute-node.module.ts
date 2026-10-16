import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ClickHouseModule } from '@probe-x/shared-utils/src/lib/backend-common'
import { ComputeNodeEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/ComputeNode.entity'
import { SystemConfigEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/SystemConfig.entity'
import { ComputeNodeService } from './compute-node.service'
import { NodeControlController } from './node-control.controller'
import { NodeRegistryService } from './node-registry.service'
import { CleaningSchedulerService } from './cleaning-scheduler.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([ComputeNodeEntity, SystemConfigEntity]),
    ClickHouseModule,
  ],
  // 节点通过 gRPC 自动注册，不再提供手工登记的 HTTP 接口。
  controllers: [NodeControlController],
  providers: [ComputeNodeService, NodeRegistryService, CleaningSchedulerService],
  exports: [ComputeNodeService, NodeRegistryService, CleaningSchedulerService],
})
export class ComputeNodeModule {}
