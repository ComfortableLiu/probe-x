import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ProjectEntity, UserProjectRelation, UserEntity } from '@probe-x/shared-utils/src/lib/backend-common'
import { ProjectController } from './project.controller'
import { ProjectService } from './project.service'

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity, UserProjectRelation, UserEntity])],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
