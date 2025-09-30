export interface IRefreshTokenPayload {
  // 用户唯一标识
  userId: string | number
  // 令牌类型
  tokenType: 'refresh',
  // 唯一 ID
  jti: string
  // 客户端标识
  clientId: string
  // 颁发时间（当前时间戳）（单位：秒）
  iat: number
  // 过期时间（单位：秒）
  exp: number
}

export interface IAccessTokenPayload {
  // 用户唯一标识
  userId: string | number
  // 用户名（非敏感，可选）
  username: string
  // 令牌类型
  tokenType: 'access'
  // 客户端标识
  clientId: string
  // 唯一 ID
  jti: string
  // 颁发时间（当前时间戳）（单位：秒）
  iat: number
  // 过期时间（单位：秒）
  exp: number
}
