const fs = require('node:fs')
const path = require('node:path')
const dotenv = require('dotenv')
const Redis = require('ioredis')

// Server-only configuration; never mutate process.env or put Redis credentials into the Web bundle.
function createResourceClient() {
  const env = process.env.NODE_ENV || 'development'
  const envDir = path.resolve(__dirname, '../apps/data-dashboard-api-service/config/env')
  const files = process.env.SERVICE_RESOURCE_ENV_FILE ? [path.resolve(process.env.SERVICE_RESOURCE_ENV_FILE)]
    : [`.env.${env}.local`, '.env.local', `.env.${env}`, '.env'].map(name => path.join(envDir, name))
  const config = { ...process.env }
  for (const file of files) {
    if (!fs.existsSync(file)) {
      if (process.env.SERVICE_RESOURCE_ENV_FILE) throw new Error('SERVICE_RESOURCE_ENV_FILE 指向的配置文件不存在')
      continue
    }
    const parsed = dotenv.parse(fs.readFileSync(file))
    for (const [key, value] of Object.entries(parsed)) if (config[key] === undefined) config[key] = value
  }
  const client = new Redis({
    host: config.REDIS_HOST || 'localhost',
    port: Number(config.REDIS_PORT || 6379),
    db: Number(config.REDIS_DB || 0),
    password: config.REDIS_PASSWORD || undefined,
    // 超时与服务端 RedisService 对齐：远程 Redis 走公网，2s/3s 太容易误判未就绪
    connectTimeout: 10000,
    commandTimeout: 10000,
    // 断连期间命令排队等待重连（采样场景允许迟到），而不是立即失败
    enableOfflineQueue: true,
    maxRetriesPerRequest: 3,
    retryStrategy: attempt => Math.min(5000, attempt * 500),
  })
  // The monitor rate-limits actionable warnings; a connection failure never stops the web server.
  client.on('error', () => {})
  return client
}

module.exports = { createResourceClient }
