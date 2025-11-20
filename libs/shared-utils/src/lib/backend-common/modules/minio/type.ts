export interface MinioModuleOptions {
  host: string
  port: string
  accessKey: string
  secretKey: string
  useSSL: boolean
  bucket: string
  downloadExpires: number
}
