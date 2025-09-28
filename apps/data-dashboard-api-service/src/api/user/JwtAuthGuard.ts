import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * 用于保护需要JWT认证的路由的守卫
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
