import { ConfigModule } from "@nestjs/config"
import path from "node:path"
import fs from "node:fs"
import { ConfigFactory } from "@nestjs/config/dist/interfaces/config-factory.interface"

const nodeEnv = process.env.NODE_ENV || 'development'

// dist 环境（__dirname 指向 dist/apps/.../src/modules）
const distRoot = __dirname
// 源码环境（用于 ts-node / nx serve 时的 Fallback）
const sourceRoot = path.resolve(process.cwd(), 'apps/data-dashboard-api-service')

const candidateEnvPaths = [
  path.join(distRoot, 'config/env', `.env.${nodeEnv}.local`),
  path.join(distRoot, 'config/env', `.env.local`),
  path.join(distRoot, 'config/env', `.env.${nodeEnv}`),
  path.join(distRoot, 'config/env', `.env`),
  path.join(sourceRoot, 'config/env', `.env.${nodeEnv}.local`),
  path.join(sourceRoot, 'config/env', `.env.local`),
  path.join(sourceRoot, 'config/env', `.env.${nodeEnv}`),
  path.join(sourceRoot, 'config/env', `.env`),
]

const envFilePath = candidateEnvPaths.filter((p) => {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
})

export const envConfig = (configuration: ConfigFactory) => {
  return ConfigModule.forRoot({
    envFilePath,
    isGlobal: true,
    expandVariables: true,
    load: [configuration],
  })
}
