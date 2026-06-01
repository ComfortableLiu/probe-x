import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ProjectEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/Project.entity'
import { UserProjectRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserProjectRelation.entity'
import { UserEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/User.entity'
import { UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserRoleRelation.entity'
import { Role } from '@probe-x/shared-utils/src/lib/backend-common/entity/Role.entity'
import { ProjectController } from './project.controller'
import { ProjectService } from './project.service'
import { AdminGuard } from '../../guard/admin.guard'

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity, UserProjectRelation, UserEntity, UserRoleRelation, Role])],
  controllers: [ProjectController],
  providers: [ProjectService, AdminGuard],
  exports: [ProjectService],
})
export class ProjectModule {}
