import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ComputeNodeEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/ComputeNode.entity'
import { UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserRoleRelation.entity'
import { Role } from '@probe-x/shared-utils/src/lib/backend-common/entity/Role.entity'
import { ComputeNodeController } from './compute-node.controller'
import { ComputeNodeService } from './compute-node.service'
import { NodeControlController } from './node-control.controller'
import { NodeRegistryService } from './node-registry.service'
import { AdminGuard } from '../../guard/admin.guard'

@Module({
  imports: [TypeOrmModule.forFeature([ComputeNodeEntity, UserRoleRelation, Role])],
  // NodeControlController 只有 gRPC handler，没有 HTTP 路由，不走 AdminGuard
  controllers: [ComputeNodeController, NodeControlController],
  providers: [ComputeNodeService, NodeRegistryService, AdminGuard],
  exports: [ComputeNodeService, NodeRegistryService],
})
export class ComputeNodeModule {}
