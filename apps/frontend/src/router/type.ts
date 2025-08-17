import { FC, LazyExoticComponent } from "react";

export interface IMetadata {
  title: string
  description: string
  keywords: string
}

export interface IRouteItem {
  path: `/${string}`,
  alias?: `/${string}`[]
  key: string,
  name: string,
  children?: IRouteItem[]
  component?: LazyExoticComponent<FC>
  meta?: {
    isHidden?: boolean;
    // 为了SEO，只好委屈你了，所有页面必须要写一个描述
    seoHead: IMetadata
  }
}
