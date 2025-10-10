import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TrackingNodeService } from './tracking-node.service'
import { UserModule } from '../user/user.module'
import { TrackingNodeController } from "@src/api/tracking-node/tracking-node.controller"
import { TrackingNodeEntity } from "@entity/TrackingNode.entity"

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackingNodeEntity]),
    UserModule,
  ],
  controllers: [TrackingNodeController],
  providers: [TrackingNodeService],
  exports: [TrackingNodeService],
})
export class TrackingNodeModule {
}
