import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { NotificationEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/Notification.entity'
import { UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserRoleRelation.entity'
import { Role } from '@probe-x/shared-utils/src/lib/backend-common/entity/Role.entity'
import { NotificationController } from './notification.controller'
import { NotificationService } from './notification.service'
import { AdminGuard } from '../../guard/admin.guard'

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity, UserRoleRelation, Role])],
  controllers: [NotificationController],
  providers: [NotificationService, AdminGuard],
  exports: [NotificationService],
})
export class NotificationModule {}
