/**
 * 业务错误码含义
 * 1xxx - 账号相关错误码，包括权限
 */
export const ErrorCode = {
  // 成功
  SUCCESS: 200,
  // 账号或密码错误
  ACCOUNT_PASSWORD_ERROR: 1000,
  // token过期或不存在
  TOKEN_EXPIRED: 1001,
  // 刷新token过期，需要重新登陆
  REFRESH_TOKEN_EXPIRED: 1002,
}
