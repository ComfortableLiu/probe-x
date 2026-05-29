import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ComputeNodeEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/ComputeNode.entity'
import { ComputeNodeController } from './compute-node.controller'
import { ComputeNodeService } from './compute-node.service'

@Module({
  imports: [TypeOrmModule.forFeature([ComputeNodeEntity])],
  controllers: [ComputeNodeController],
  providers: [ComputeNodeService],
  exports: [ComputeNodeService],
})
export class ComputeNodeModule {}
