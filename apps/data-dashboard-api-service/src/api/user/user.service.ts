import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { UserEntity } from "@entity/User.entity"
import { timingSafeEqual } from "node:crypto"
import { AuthService } from "@src/service/auth.service"
import { ResponseData } from "@probe-x/shared-utils/src/lib/backend-common/index"
import { ConfigService } from "@nestjs/config"

@Injectable()
export class UserService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {
  }

  /**
   * 根据uid获取用户信息
   * @param id
   */
  async getUserById(id: number) {
    const user = await this.userRepository.findOne({ where: { userId: id } })
    return {
      ...user,
      passwordHash: '*******',
    }
  }

  /**
   * 验证用户并生成JWT令牌
   * @param username
   * @param password
   */
  async validateUser(username: string, password: string) {
    const user = await this.userRepository.findOne({ where: { username } })

    // 检查用户是否存在且密码正确
    if (user && (this.checkPassword(password, user.passwordHash))) {
      // 生成JWT令牌
      const accessToken = this.authService.generateAccessToken(user.userId, user.username)
      // 生成刷新令牌
      const refreshToken = this.authService.generateRefreshToken(user.userId)
      return {
        accessToken,
        refreshToken,
        userInfo: {
          ...user,
          passwordHash: '*******',
        },
      }
    }

    return ResponseData.error("用户名或密码错误")
  }

  /**
   * 验证SSO token
   * @param token
   */
  async validateSsoToken(token: string) {
    try {
      // 验证JWT token
      const decoded = this.jwtService.verify(token)

      // 根据username查找用户
      const user = await this.userRepository.findOne({
        where: { username: decoded.username },
      })

      // 检查用户是否存在
      if (user) {
        return {
          userInfo: {
            ...user,
            passwordHash: '*******',
          },
        }
      }

      return null
    } catch (error) {
      // token验证失败
      return null
    }
  }

  /**
   * 生成JWT token
   * @param user
   */
  async generateJwtToken(user: any) {
    const payload = { username: user.username, sub: user.id }
    return this.jwtService.sign(payload)
  }

  /**
   * 验证密码
   * @param password
   * @param hash
   */
  private checkPassword(password: string, hash: string): boolean {
    // 使用bcrypt比较密码
    return this.safeCompare(password, hash)
  }

  private safeCompare(a: string, b: string): boolean {
    const bufferA = Buffer.from(a)
    const bufferB = Buffer.from(b)
    return bufferA.length === bufferB.length &&
      timingSafeEqual(bufferA, bufferB)
  }
}
