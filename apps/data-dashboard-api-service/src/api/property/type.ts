import { MetaPropertyBusinessType } from "@probe-x/shared-types/src"

export interface PropertyFilterDto {
  eventName?: string;
  propertyName?: string;
  status?: number;
  type?: MetaPropertyBusinessType;
}

export interface PaginationDto {
  page: number;
  pageSize: number;
}
