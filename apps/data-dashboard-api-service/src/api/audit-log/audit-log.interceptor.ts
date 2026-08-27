import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { AuditLogService } from './audit-log.service'

/**
 * 审计日志拦截器
 * 自动记录所有写操作（POST/PUT/DELETE）的审计日志
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const method = request.method

    // 只记录写操作
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return next.handle()
    }

    // 跳过审计日志自身的查询和认证相关路由
    const path = request.url || request.path || ''
    if (path.includes('/audit-log') || path.includes('/api/user/login') || path.includes('/auth/register')) {
      return next.handle()
    }

    const startTime = Date.now()
    const user = request.user || {}
    const body = request.body ? this.redactSensitive(JSON.stringify(request.body)).substring(0, 2000) : undefined
    const ip = request.ip || request.headers?.['x-forwarded-for'] || request.connection?.remoteAddress
    const userAgent = request.headers?.['user-agent']

    // 从路径解析操作类型
    const action = this.parseAction(method, path)

    return next.handle().pipe(
      tap({
        next: (response) => {
          const responseStatus = response?.code || 200
          // 异步写入日志，不阻塞响应
          this.auditLogService.createLog({
            userId: user.userId,
            username: user.username,
            action,
            method,
            path,
            requestBody: body,
            responseStatus,
            ip,
            userAgent,
          }).catch(() => {}) // 静默失败，不影响主流程
        },
        error: () => {
          this.auditLogService.createLog({
            userId: user.userId,
            username: user.username,
            action,
            method,
            path,
            requestBody: body,
            responseStatus: 500,
            ip,
            userAgent,
          }).catch(() => {})
        },
      }),
    )
  }

  /**
   * 脱敏处理：对敏感字段值替换为 ***
   * 键名包含 password/secret/token 等敏感词即脱敏（不区分大小写、子串匹配），
   * 覆盖 oldPassword/newPassword/accessToken 等变体
   */
  private redactSensitive(json: string): string {
    // 对 JSON 中的敏感字段值进行替换
    return json.replace(
      /("[^"]*(?:password|secret|token|config|smtp|authorization)[^"]*":\s*")((?:[^"\\]|\\.)*)(?=")/gi,
      '$1***',
    )
  }

  /**
   * 从请求路径解析操作类型
   */
  private parseAction(method: string, path: string): string {
    // 从路径中提取动作关键词
    if (path.includes('/create')) return 'create'
    if (path.includes('/update')) return 'update'
    if (path.includes('/delete')) return 'delete'
    if (path.includes('/login')) return 'login'
    if (path.includes('/logout')) return 'logout'
    if (path.includes('/test-send')) return 'test_send'
    if (path.includes('/test-connection')) return 'test_connection'
    if (path.includes('/members/add')) return 'add_member'
    if (path.includes('/members/remove')) return 'remove_member'

    // 根据 HTTP 方法兜底
    switch (method) {
      case 'POST': return 'create'
      case 'PUT':
      case 'PATCH': return 'update'
      case 'DELETE': return 'delete'
      default: return 'unknown'
    }
  }
}
