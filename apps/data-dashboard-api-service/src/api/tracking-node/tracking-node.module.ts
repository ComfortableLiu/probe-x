import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TrackingNodeService } from './tracking-node.service'
import { UserModule } from '../user/user.module'
import { TrackingNodeController } from "@src/api/tracking-node/tracking-node.controller"
import { TrackingNodeEntity } from "@probe-x/shared-utils/src/lib/backend-common/entity/TrackingNode.entity"
import { System } from "@probe-x/shared-utils/src/lib/backend-common/entity/System.entity"

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackingNodeEntity, System]),
    UserModule,
  ],
  controllers: [TrackingNodeController],
  providers: [TrackingNodeService],
  exports: [TrackingNodeService],
})
export class TrackingNodeModule {
}
