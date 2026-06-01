import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AlertRuleEntity, AlertHistoryEntity, NotificationEntity } from '@probe-x/shared-utils/src/lib/backend-common'
import { UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserRoleRelation.entity'
import { Role } from '@probe-x/shared-utils/src/lib/backend-common/entity/Role.entity'
import { AlertController } from './alert.controller'
import { AlertService } from './alert.service'
import { NotificationModule } from '../notification/notification.module'
import { AdminGuard } from '../../guard/admin.guard'

@Module({
  imports: [
    TypeOrmModule.forFeature([AlertRuleEntity, AlertHistoryEntity, NotificationEntity, UserRoleRelation, Role]),
    forwardRef(() => NotificationModule),
  ],
  controllers: [AlertController],
  providers: [AlertService, AdminGuard],
  exports: [AlertService],
})
export class AlertModule {}
