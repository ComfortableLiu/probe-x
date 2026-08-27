export interface RedisModuleOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
  retryStrategy?: (times: number) => number;
}

// 数据库0保存 deviceId 维度的utm信息和sessionId，以及最近一次更新时间
export interface IUserCacheData {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;

  deviceId: string;
  sessionId: string;
  // 经 JSON 序列化存入 Redis，读取后为 string
  updatedAt: string;
}