export default () => {
  // 关键密钥未配置时直接抛错，阻止服务启动（与 JWT_SECRET 的处理对齐）
  if (!process.env.HMAC_SECRET) {
    throw new Error('HMAC_SECRET 环境变量未配置，服务无法启动')
  }
  if (!process.env.SALT) {
    throw new Error('SALT 环境变量未配置，服务无法启动')
  }
  // 数据源密码加密开关：默认开启，设为 false 可关闭（关闭时密码明文入库）
  const datasourceEncryptEnabled = process.env.DATASOURCE_ENCRYPT_ENABLED !== 'false'
  if (datasourceEncryptEnabled && !process.env.DATASOURCE_ENCRYPT_SECRET) {
    throw new Error('DATASOURCE_ENCRYPT_SECRET 环境变量未配置，服务无法启动（如需关闭加密请设置 DATASOURCE_ENCRYPT_ENABLED=false）')
  }

  return {
    client: {
      host: process.env.CLIENT_HOST || 'http://localhost',
      port: parseInt(process.env.CLIENT_PORT || '', 10) || 8000,
    },
    login: {
      secret: process.env.HMAC_SECRET || '',
      salt: process.env.SALT || '',
      throttleEnabled: process.env.LOGIN_THROTTLE_ENABLED !== 'false', // 默认开启，设为 false 可关闭
      throttleMaxAttempts: parseInt(process.env.LOGIN_THROTTLE_MAX_ATTEMPTS || '', 10) || 5,
      throttleWindowMs: parseInt(process.env.LOGIN_THROTTLE_WINDOW_MS || '', 10) || 15 * 60 * 1000,
      trustProxy: process.env.LOGIN_TRUST_PROXY === 'true', // 是否存在可信代理（决定限流是否读取 x-forwarded-for）
    },
    datasource: {
      encryptEnabled: datasourceEncryptEnabled,
      encryptSecret: process.env.DATASOURCE_ENCRYPT_SECRET || '',
    },
    jwt: {
      secret: process.env.JWT_SECRET || '',
      expiresIn: process.env.JWT_EXPIRES_IN || '86400',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '604800',
    },
    services: {
      dataDashboardApi: {
        host: process.env.DATA_DASHBOARD_API_SERVICE_HOST || 'http://localhost',
        port: parseInt(process.env.DATA_DASHBOARD_API_SERVICE_PORT || '', 10) || 8101,
      },
      finalDataCleaning: {
        host: process.env.FINAL_DATA_CLEANING_SERVICE_HOST || 'http://localhost',
        port: parseInt(process.env.FINAL_DATA_CLEANING_SERVICE_PORT || '', 10) || 8102,
      },
      preliminaryDataProcessing: {
        host: process.env.PRELIMINARY_DATA_PROCESSING_SERVICE_HOST || 'http://localhost',
        port: parseInt(process.env.PRELIMINARY_DATA_PROCESSING_SERVICE_PORT || '', 10) || 8103,
      },
      receivingPoint: {
        host: process.env.RECEIVING_POINT_SERVICE_HOST || 'http://localhost',
        port: parseInt(process.env.RECEIVING_POINT_SERVICE_PORT || '', 10) || 8104,
      },
    },
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '', 10) || 3306,
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'probe_x',
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
    },
    clickhouse: {
      host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USER || 'admin',
      password: process.env.CLICKHOUSE_PASSWORD || '',
      database: process.env.CLICKHOUSE_DATABASE || 'probe_x',
      tls: process.env.CLICKHOUSE_TLS === 'true',
      rejectUnauthorized: process.env.CLICKHOUSE_REJECT_UNAUTHORIZED !== 'false',
      requestTimeout: parseInt(process.env.CLICKHOUSE_REQUEST_TIMEOUT || '', 10) || 30000,
      connectionTimeout: parseInt(process.env.CLICKHOUSE_CONNECTION_TIMEOUT || '', 10) || 10000,
      compression: process.env.CLICKHOUSE_COMPRESSION !== 'false',
    },
    kafka: {
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      clientId: process.env.KAFKA_CLIENT_ID || 'data-dashboard-api-service',
      groupId: process.env.KAFKA_CONSUMER_GROUP_ID || 'data-dashboard-api-group',
      authType: process.env.KAFKA_AUTH_TYPE || 'none',
      saslUsername: process.env.KAFKA_SASL_USERNAME || '',
      saslPassword: process.env.KAFKA_SASL_PASSWORD || '',
      sslEnabled: process.env.KAFKA_SSL_ENABLED === 'true',
      sslRejectUnauthorized: process.env.KAFKA_SSL_REJECT_UNAUTHORIZED !== 'false',
      connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || '', 10) || 10000,
      requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '', 10) || 30000,
      retryCount: parseInt(process.env.KAFKA_RETRY_COUNT || '', 10) || 3,
      retryDelay: parseInt(process.env.KAFKA_RETRY_DELAY || '', 10) || 1000,
      consumerAutoOffsetReset: process.env.KAFKA_CONSUMER_AUTO_OFFSET_RESET || 'latest',
      consumerEnableAutoCommit: process.env.KAFKA_CONSUMER_ENABLE_AUTO_COMMIT === 'true',
      consumerAutoCommitInterval: parseInt(process.env.KAFKA_CONSUMER_AUTO_COMMIT_INTERVAL || '', 10) || 5000,
      consumerBatchSize: parseInt(process.env.KAFKA_CONSUMER_BATCH_SIZE || '', 10) || 100,
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '', 10) || 6379,
      password: process.env.REDIS_PASSWORD || '',
      db: parseInt(process.env.REDIS_DB || '', 10) || 0,
      maxConnections: parseInt(process.env.REDIS_MAX_CONNECTIONS || '', 10) || 10,
      minIdleConnections: parseInt(process.env.REDIS_MIN_IDLE_CONNECTIONS || '', 10) || 2,
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '', 10) || 10000,
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '', 10) || 5000,
      tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true',
      retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '', 10) || 1000,
      maxRetryAttempts: parseInt(process.env.REDIS_MAX_RETRY_ATTEMPTS || '', 10) || 3,
      clusterEnabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
      clusterNodes: process.env.REDIS_CLUSTER_NODES?.split(',') || [],
    },
    minio: {
      host: process.env.MINIO_HOST || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '', 10) || 6800,
      accessKey: process.env.MINIO_ACCESS_KEY || '',
      secretKey: process.env.MINIO_SECRET_KEY || '',
      useSSL: process.env.MINIO_USE_SSL === 'true',
      bucket: process.env.MINIO_BUCKET || 'probe-x',
      downloadExpires: parseInt(process.env.MINIO_DOWNLOAD_EXPIRES || '', 10) || 1800,
    },
  }
}
