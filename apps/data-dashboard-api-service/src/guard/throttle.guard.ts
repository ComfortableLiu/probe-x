import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common'

interface RateLimitEntry {
  count: number
  resetTime: number
}

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private static attempts = new Map<string, RateLimitEntry>()
  private static readonly MAX_ATTEMPTS = 5
  private static readonly WINDOW_MS = 15 * 60 * 1000 // 15分钟

  // 定期清理过期条目，防止内存泄漏
  private static cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of LoginThrottleGuard.attempts) {
      if (now > entry.resetTime) {
        LoginThrottleGuard.attempts.delete(key)
      }
    }
  }, 60 * 1000)

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown'
    const key = `login:${ip}`
    const now = Date.now()

    const entry = LoginThrottleGuard.attempts.get(key)

    if (entry && now < entry.resetTime) {
      if (entry.count >= LoginThrottleGuard.MAX_ATTEMPTS) {
        throw new HttpException(
          '登录尝试次数过多，请15分钟后再试',
          HttpStatus.TOO_MANY_REQUESTS,
        )
      }
      entry.count++
    } else {
      LoginThrottleGuard.attempts.set(key, { count: 1, resetTime: now + LoginThrottleGuard.WINDOW_MS })
    }

    return true
  }
}
