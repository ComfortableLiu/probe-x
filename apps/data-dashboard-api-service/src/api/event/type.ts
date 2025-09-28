export interface EventFilterDto {
  eventName?: string;
  eventAliases?: string;
  status?: number;
}

export interface PaginationDto {
  page: number;
  pageSize: number;
}

// 定义返回的事件详情类型
export interface EventDetailDto {
  eventName: string;
  eventAliases: string;
  eventRemark: string;
  creatTime: Date;
  creatUserId: number;
  updateUserId: number;
  updateTime: Date;
  status: number;
  properties: Array<{
    propertyName: string;
    propertyType: string;
    eventPropertyRemark: string;
    creatTime: Date;
  }>;
}

export interface UpdateEventDto {
  eventAliases?: string;
  eventRemark?: string;
  status?: number;
}
