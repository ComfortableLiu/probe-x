import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLogEntity, Role, UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common'
import { AuditLogController } from './audit-log.controller'
import { AuditLogService } from './audit-log.service'
import { AuditLogInterceptor } from './audit-log.interceptor'
import { AdminGuard } from '../../guard/admin.guard'

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity, UserRoleRelation, Role])],
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    AdminGuard,
    // 全局注册审计日志拦截器，自动记录写操作
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  exports: [AuditLogService],
})
export class AuditLogModule {}
