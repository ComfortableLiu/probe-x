import { Body, Controller, Get, Post, Query } from "@nestjs/common"
import { PropertyService } from "@src/api/property/property.service"
import type { ICreatePropertyReq } from "@probe-x/shared-types/src"
import { MetaPropertyBusinessType } from "@probe-x/shared-types/src"
import type { PropertyFilterDto } from "@src/api/property/type"

@Controller('property')
export class PropertyController {

  constructor(
    private readonly propertyService: PropertyService,
  ) {
  }

  /**
   * 获取属性列表
   * @param page
   * @param pageSize
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
   * 获取所有公共属性
   */
  @Get('commonList')
  async getCommonProperties() {
    return await this.propertyService.getCommonProperties()
  }

  /**
   * 获取所有公共属性
   */
  @Post('create')
  async createProperty(
    @Body() body: ICreatePropertyReq,
  ) {
    return await this.propertyService.createProperty(body)
  }
}
