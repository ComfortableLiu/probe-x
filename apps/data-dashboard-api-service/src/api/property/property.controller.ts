import { Controller, Get, Query } from "@nestjs/common"
import { PropertyService } from "@src/api/property/property.service"
import { MetaPropertyBusinessType } from "@probe-x/shared-types/src"
import type { PaginationDto, PropertyFilterDto } from "@src/api/property/type"

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
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('eventName') eventName?: string,
    @Query('propertyName') propertyName?: string,
    @Query('type') type?: MetaPropertyBusinessType,
  ) {

    const filter: PropertyFilterDto = {
      eventName,
      propertyName,
      type,
    }

    const pagination: PaginationDto = {
      page: Math.max(1, page),
      pageSize: Math.max(1, Math.min(100, pageSize || 10)),
    }
    return await this.propertyService.getPropertyListWithPagination(filter, pagination)
  }

  /**
   * 获取所有公共属性
   */
  @Get('commonList')
  async getCommonProperties() {
    return await this.propertyService.getCommonProperties()
  }
}
