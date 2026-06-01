import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ComputeNodeEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/ComputeNode.entity'
import { UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserRoleRelation.entity'
import { Role } from '@probe-x/shared-utils/src/lib/backend-common/entity/Role.entity'
import { ComputeNodeController } from './compute-node.controller'
import { ComputeNodeService } from './compute-node.service'
import { AdminGuard } from '../../guard/admin.guard'

@Module({
  imports: [TypeOrmModule.forFeature([ComputeNodeEntity, UserRoleRelation, Role])],
  controllers: [ComputeNodeController],
  providers: [ComputeNodeService, AdminGuard],
  exports: [ComputeNodeService],
})
export class ComputeNodeModule {}
