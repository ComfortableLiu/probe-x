import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLogEntity } from '@probe-x/shared-utils/src/lib/backend-common'
import { AuditLogController } from './audit-log.controller'
import { AuditLogService } from './audit-log.service'

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
