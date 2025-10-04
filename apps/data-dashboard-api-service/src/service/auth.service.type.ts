export interface ITokenPayload {
  // 用户唯一标识
  userId: string | number
  username: string
  // 令牌类型
  tokenType: 'refresh' | 'access',
  // 唯一 ID
  jti: string
  // 客户端标识
  clientId: string
  // 颁发时间（当前时间戳）（单位：秒）
  iat: number
  // 过期时间（单位：秒）
  exp: number
}
