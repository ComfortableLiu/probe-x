import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Observable } from 'rxjs'

/**
 * 用于SSO认证的守卫
 */
@Injectable()
export class SsoAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // 实现SSO验证逻辑
    // TODO 这里应该检查请求中的SSO token
    return true // 简化演示，始终返回true
  }
}