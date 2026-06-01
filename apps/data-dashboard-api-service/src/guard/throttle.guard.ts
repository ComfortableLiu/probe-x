import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface RateLimitEntry {
  count: number
  resetTime: number
}

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private attempts = new Map<string, RateLimitEntry>()
  private readonly maxAttempts: number
  private readonly windowMs: number
  private readonly enabled: boolean

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('login.throttleEnabled') ?? true
    this.maxAttempts = this.configService.get<number>('login.throttleMaxAttempts') ?? 5
    this.windowMs = this.configService.get<number>('login.throttleWindowMs') ?? 15 * 60 * 1000

    // 定期清理过期条目，防止内存泄漏
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.attempts) {
        if (now > entry.resetTime) {
          this.attempts.delete(key)
        }
      }
    }, 60 * 1000)
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.enabled) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown'
    const key = `login:${ip}`
    const now = Date.now()

    const entry = this.attempts.get(key)

    if (entry && now < entry.resetTime) {
      if (entry.count >= this.maxAttempts) {
        const remainingSeconds = Math.ceil((entry.resetTime - now) / 1000)
        const remainingMinutes = Math.ceil(remainingSeconds / 60)
        throw new HttpException(
          `登录尝试次数过多，请${remainingMinutes}分钟后再试`,
          HttpStatus.TOO_MANY_REQUESTS,
        )
      }
      entry.count++
    } else {
      this.attempts.set(key, { count: 1, resetTime: now + this.windowMs })
    }

    return true
  }
}
