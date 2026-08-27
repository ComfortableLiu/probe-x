import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bullmq'
import { AlertRuleEntity, AlertHistoryEntity, ClickHouseModule } from '@probe-x/shared-utils/src/lib/backend-common'
import { UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserRoleRelation.entity'
import { Role } from '@probe-x/shared-utils/src/lib/backend-common/entity/Role.entity'
import { AlertController } from './alert.controller'
import { AlertService } from './alert.service'
import { AlertProcessor } from './alert.processor'
import { QUEUE_NAME } from './type'
import { AdminGuard } from '../../guard/admin.guard'

@Module({
  imports: [
    TypeOrmModule.forFeature([AlertRuleEntity, AlertHistoryEntity, UserRoleRelation, Role]),
    ClickHouseModule,
    BullModule.registerQueue({ name: QUEUE_NAME }),
  ],
  controllers: [AlertController],
  providers: [AlertService, AlertProcessor, AdminGuard],
  exports: [AlertService],
})
export class AlertModule {}
