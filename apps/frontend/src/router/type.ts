import { FC, LazyExoticComponent, ReactNode } from "react"

export interface IMetadata {
  title: string
  description: string
  keywords: string
}

export interface IRouteItem {
  path?: `/${string}`
  alias?: `/${string}`[]
  key: string
  name: string
  children?: IRouteItem[]
  component?: LazyExoticComponent<FC>
  meta?: {
    icon?: ReactNode
    isHidden?: boolean
    permissionId?: string | string[]
  }
}
