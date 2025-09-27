// 环境配置管理模块
interface EnvironmentConfig {
  signatureSecret: string;
  serverHost: string;
  serverPort: number;
  clientHost: string;
  clientPort: number;
  ssoUrl: string;

  version: string;
  apiBaseUrl: string;
  environment: 'development' | 'production' | '';
}

// 从环境变量中读取配置
const getConfig = (): EnvironmentConfig => {
  // 动态导入 package.json 以获取版本号
  const packageJson = require('../package.json')

  const environment = process.env.NODE_ENV || ''
  const serverHost = process.env.DASHBOARD_HOST || 'http://localhost'
  const serverPort = parseInt(process.env.DASHBOARD_POST || '3001', 10)
  const clientHost = process.env.CLIENT_HOST || 'http://localhost'
  const clientPort = parseInt(process.env.CLIENT_PORT || '3000', 10)
  const ssoUrl = process.env.SSO || `${clientHost}:${clientPort}`
  const apiBaseUrl = `${serverHost}:${serverPort}/api`
  const version = packageJson.version

  return {
    signatureSecret: process.env.SIGNATURE_SECRET || '',
    serverHost,
    serverPort,
    clientHost,
    clientPort,
    ssoUrl,
    apiBaseUrl,
    version,
    environment: environment as 'development' | 'production' | '',
  }
}

// 获取当前环境配置
const config = getConfig()

// 根据环境获取配置值的辅助函数
export const get = <T>(key: keyof EnvironmentConfig): T => {
  return config[key] as T
}

// 检查是否为测试环境
export const isDevelopment = (): boolean => {
  return config.environment === 'development'
}

// 检查是否为生产环境
export const isProduction = (): boolean => {
  return config.environment === 'production'
}
