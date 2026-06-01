import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ProjectService } from './project.service'
import {
  ICreateProjectReq,
  ICreateProjectRes,
  IDeleteProjectReq,
  IQueryProjectListReq,
  IQueryProjectListRes,
  IUpdateProjectReq,
  IUpdateProjectRes,
  IAddProjectMemberReq,
  IRemoveProjectMemberReq,
  IProjectMemberItem,
} from '@probe-x/shared-types/src'
import { ResponseData } from '@probe-x/shared-utils/src/lib/backend-common'
import { AdminGuard } from '../../guard/admin.guard'

@UseGuards(AdminGuard)
@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get('list')
  async getList(
    @Query('projectName') projectName?: string,
    @Query('projectKey') projectKey?: string,
    @Query('isEnable') isEnable?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<IQueryProjectListRes> {
    const params: IQueryProjectListReq = {
      projectName,
      projectKey,
      isEnable: isEnable === 'true' || isEnable === '1' ? true : isEnable === 'false' || isEnable === '0' ? false : undefined,
      page: page || 1,
      pageSize: pageSize || 20,
    }
    return await this.projectService.getList(params)
  }

  @Post('create')
  async create(@Body() body: ICreateProjectReq): Promise<ResponseData<ICreateProjectRes>> {
    return await this.projectService.create(body)
  }

  @Post('update')
  async update(@Body() body: IUpdateProjectReq): Promise<ResponseData<IUpdateProjectRes>> {
    return await this.projectService.update(body)
  }

  @Post('delete')
  async delete(@Body() body: IDeleteProjectReq): Promise<ResponseData<null>> {
    return await this.projectService.delete(body.id)
  }

  @Get(':id/members')
  async getMembers(
    @Param('id') id: string,
  ): Promise<ResponseData<IProjectMemberItem[]>> {
    return await this.projectService.getMembers(Number(id))
  }

  @Post(':id/members/add')
  async addMembers(
    @Param('id') id: string,
    @Body() body: { userIds: number[] },
  ): Promise<ResponseData<null>> {
    return await this.projectService.addMembers({ projectId: Number(id), userIds: body.userIds })
  }

  @Post(':id/members/remove')
  async removeMember(
    @Param('id') id: string,
    @Body() body: { userId: number },
  ): Promise<ResponseData<null>> {
    return await this.projectService.removeMember({ projectId: Number(id), userId: body.userId })
  }
}
