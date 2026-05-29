import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AlertRuleEntity, AlertHistoryEntity, NotificationEntity } from '@probe-x/shared-utils/src/lib/backend-common'
import { AlertController } from './alert.controller'
import { AlertService } from './alert.service'
import { NotificationModule } from '../notification/notification.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([AlertRuleEntity, AlertHistoryEntity, NotificationEntity]),
    forwardRef(() => NotificationModule),
  ],
  controllers: [AlertController],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertModule {}
