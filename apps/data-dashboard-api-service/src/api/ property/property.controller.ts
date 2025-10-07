import { Controller, Get, Query } from "@nestjs/common"
import { PropertyService } from "@src/api/ property/property.service"

@Controller('property')
export class PropertyController {

  constructor(
    private readonly propertyService: PropertyService,
  ) {
  }

  /**
   * 获取某个事件的所有属性
   */
  @Get('list')
  async getProperties(@Query('eventName') eventName: string) {
    return await this.propertyService.getPropertiesByEventName(eventName)
  }

  /**
   * 获取所有公共属性
   */
  @Get('commonList')
  async getCommonProperties() {
    return await this.propertyService.getCommonProperties()
  }
}
