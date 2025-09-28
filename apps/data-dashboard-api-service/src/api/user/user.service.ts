import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

@Injectable()
export class UserService {
  constructor(
    private readonly jwtService: JwtService,
  ) {
  }

  /**
   * 根据uid获取用户信息
   * @param id
   */
  async getUserById(id: number) {
    // TODO 完善数据库
    return {
      id,
      username: 'admin',
      password: 'password',
    }
  }

  /**
   * 验证用户并生成JWT令牌
   * @param username
   * @param password
   */
  async validateUser(username: string, password: string) {
    // TODO: 从数据库获取用户信息
    const user = {
      id: 1,
      username: 'admin',
      password: '$2b$10$B8G0x4.6aVvD1746Z1B8hOuI7a4W7g5q4N3m2l1k9j8i7h6g5f4e3d2c1O', // password加密后的hash
    }

    // 检查用户是否存在且密码正确
    if (user && (await this.checkPassword(password, user.password))) {
      // 生成JWT令牌
      const payload = { username: user.username, sub: user.id }
      return {
        accessToken: this.jwtService.sign(payload),
        user: {
          ...user,
          password: '******',
        },
      }
    }

    return null
  }

  /**
   * 验证SSO token
   * @param token
   */
  async validateSsoToken(token: string) {
    // TODO 这里应该调用SSO服务来验证token
    // 为演示目的，我们假设token有效并返回用户信息
    if (token) {
      return {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
      }
    }
    return null
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
  private async checkPassword(password: string, hash: string): Promise<boolean> {
    // TODO 在实际应用中，应该使用bcrypt比较密码
    // return bcrypt.compare(password, hash);
    // 为了简化演示，直接比较密码
    return password === 'password'
  }
}
