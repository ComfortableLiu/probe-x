import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common"
import { PropertyService } from "@src/api/property/property.service"
import type { ICreatePropertyReq } from "@probe-x/shared-types/src"
import { MetaPropertyBusinessType } from "@probe-x/shared-types/src"
import type { PropertyFilterDto } from "@src/api/property/type"
import { AdminGuard } from "../../guard/admin.guard"

@Controller('property')
export class PropertyController {

  constructor(
    private readonly propertyService: PropertyService,
  ) {
  }

  /**
   * 获取属性列表
   * @param eventName 查询某个事件关联的属性列表
   * @param propertyName 筛选属性名
   * @param type 筛选类型
   */
  @Get('list')
  async getProperties(
    @Query('eventName') eventName?: string,
    @Query('propertyName') propertyName?: string,
    @Query('type') type?: MetaPropertyBusinessType,
  ) {

    const filter: PropertyFilterDto = {
      eventName,
      propertyName,
      type,
    }
    return await this.propertyService.getPropertyListWithPagination(filter)
  }

  /**
   * 获取属性列表，简化版
   */
  @Get('/list/simple')
  async getPropertiesSimple() {
    return await this.propertyService.getPropertyList()
  }

  /**
   * 获取所有公共属性
   */
  @Get('commonList')
  async getCommonProperties() {
    return await this.propertyService.getCommonProperties()
  }

  /**
   * 创建属性（仅管理员）
   */
  @Post('create')
  @UseGuards(AdminGuard)
  async createProperty(
    @Body() body: ICreatePropertyReq,
    @Req() req: any,
  ) {
    return await this.propertyService.createProperty(body, req.user)
  }
}
