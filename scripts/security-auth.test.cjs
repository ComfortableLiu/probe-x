// Offline regression tests: real guards/services/JWTs with an in-memory repository.
require('reflect-metadata')
const path = require('node:path')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createHmac } = require('node:crypto')
require('ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: { target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
})
require('tsconfig-paths').register({
  baseUrl: path.join(__dirname, '../apps/data-dashboard-api-service'),
  paths: { '@src/*': ['src/*'] },
})

const { JwtService } = require('@nestjs/jwt')
const { Reflector } = require('@nestjs/core')
const { AdminGuard } = require('../apps/data-dashboard-api-service/src/guard/admin.guard.ts')
const { DashboardAuthGuard } = require('../apps/data-dashboard-api-service/src/guard/dashboard-auth.guard.ts')
const { PermissionGuard } = require('../apps/data-dashboard-api-service/src/guard/permission.guard.ts')
const { AuthorizationService } = require('../apps/data-dashboard-api-service/src/service/authorization.service.ts')
const { AuthService } = require('../apps/data-dashboard-api-service/src/service/auth.service.ts')
const { UserService } = require('../apps/data-dashboard-api-service/src/api/user/user.service.ts')
const { SystemConfigUserService } = require('../apps/data-dashboard-api-service/src/api/system-config/user.service.ts')

const config = {
  get: key => ({
    'jwt.secret': 'test-only-jwt-secret',
    'jwt.expiresIn': '3600',
    'jwt.refreshExpiresIn': '86400',
    'login.secret': 'test-only-hmac-secret',
    'login.salt': 'test-only-salt',
  })[key],
}
const hash = value => createHmac('sha512', config.get('login.secret')).update(value + config.get('login.salt')).digest('hex')
const httpContext = request => ({ switchToHttp: () => ({ getRequest: () => request }) })
const role = (roleKey, permissionKeys = [], extras = {}) => ({
  roleKey, roleType: 'system', isEnable: 1, systemId: null,
  permissionRelations: permissionKeys.map(permissionKey => ({ permission: { permissionKey, isEnable: 1, systemId: null } })),
  ...extras,
})
const authorization = assignments => new AuthorizationService({ find: async () => assignments })

function fixture() {
  const users = new Map([[7, {
    userId: 7, username: 'review-user', email: 'review@example.test', nickname: 'Reviewer',
    isActive: true, tokenVersion: 0, passwordHash: hash(hash('initial-password')),
  }]])
  const repository = {
    findOne: async ({ where }) => {
      const found = [...users.values()].find(user => Object.entries(where).every(([key, value]) => user[key] === value))
      return found ? { ...found } : null
    },
    update: async (criteria, values) => {
      const where = typeof criteria === 'number' ? { userId: criteria } : criteria
      const found = [...users.values()].find(user => Object.entries(where).every(([key, value]) => user[key] === value))
      if (!found) return { affected: 0 }
      for (const [key, value] of Object.entries(values)) {
        if (value !== undefined) found[key] = typeof value === 'function' ? found[key] + 1 : value
      }
      return { affected: 1 }
    },
  }
  const jwt = new JwtService({ secret: config.get('jwt.secret') })
  const auth = new AuthService(jwt, config)
  const authz = authorization([])
  const service = new UserService(jwt, config, auth, repository, {}, {}, {}, authz)
  const adminService = new SystemConfigUserService(repository, {}, {}, config, {})
  const guard = new DashboardAuthGuard(jwt, service)
  const accessAllowed = token => guard.canActivate(httpContext({
    path: '/api/tracking/spm/business/update', headers: { authorization: `Bearer ${token}` },
  }))
  return { users, service, adminService, jwt, auth, accessAllowed }
}

test('system analysts do not become admins; assigned functional permissions still work', async () => {
  const authz = authorization([{ systemId: null, role: role('data_analyst', ['spm:update']) }])
  const guard = new AdminGuard(authz)
  await assert.rejects(guard.canActivate(httpContext({ user: { userId: 7 } })), /无管理员权限/)
  assert.equal(await authz.hasPermissions(7, ['spm:update']), true)
  assert.equal(await authz.hasPermissions(7, ['spm:create']), false)
  assert.equal(await authorization([{ systemId: null, role: role('admin') }]).isAdmin(7), true)
})

test('disabled or system-scoped roles and permissions do not grant global capabilities', async () => {
  for (const assignment of [
    { systemId: null, role: role('admin', [], { isEnable: 0 }) },
    { systemId: 10, role: role('admin') },
    { systemId: null, role: role('admin', [], { systemId: 10 }) },
  ]) {
    assert.equal(await authorization([assignment]).isAdmin(7), false)
    assert.equal(await authorization([assignment]).hasPermissions(7, ['spm:update']), false)
  }
  const disabled = role('developer', ['spm:update'])
  disabled.permissionRelations[0].permission.isEnable = 0
  assert.equal(await authorization([{ role: disabled }]).hasPermissions(7, ['spm:update']), false)
})

test('write routes reject roleless callers through actual decorator metadata', async () => {
  const { TrackingNodeController } = require('../apps/data-dashboard-api-service/src/api/tracking-node/tracking-node.controller.ts')
  const { UtmController } = require('../apps/data-dashboard-api-service/src/api/utm/utm.controller.ts')
  const { EventController } = require('../apps/data-dashboard-api-service/src/api/event/event.controller.ts')
  const { PropertyController } = require('../apps/data-dashboard-api-service/src/api/property/property.controller.ts')
  const { DashboardController } = require('../apps/data-dashboard-api-service/src/api/dashboard/dashboard.controller.ts')
  const guard = new PermissionGuard(new Reflector(), authorization([]))
  for (const [Controller, methods] of [
    [TrackingNodeController, ['createBusiness', 'updateBusiness', 'createSpmNode', 'updateSpmNode', 'createScmBusiness', 'updateScmBusiness', 'createScmNode', 'updateScmNode']],
    [UtmController, ['update', 'remove', 'restore', 'recalc', 'fullSync', 'incrementalSync']],
    [EventController, ['registerEvent']],
    [PropertyController, ['createProperty']],
    [DashboardController, ['createDashboard', 'updateDashboard', 'deleteDashboard', 'convertToPublicDashboard']],
  ]) {
    for (const method of methods) {
      const handler = Controller.prototype[method]
      assert.ok(Reflect.getMetadata('__guards__', handler).includes(PermissionGuard), `${Controller.name}.${method} needs its guard`)
      await assert.rejects(guard.canActivate({
        ...httpContext({ user: { userId: 7 } }), getHandler: () => handler, getClass: () => Controller,
      }), /无操作权限/)
    }
  }
  const authorizedGuard = new PermissionGuard(new Reflector(), authorization([{ role: role('developer', ['spm:update']) }]))
  assert.equal(await authorizedGuard.canActivate({
    ...httpContext({ user: { userId: 7 } }),
    getHandler: () => TrackingNodeController.prototype.updateBusiness,
    getClass: () => TrackingNodeController,
  }), true)
})

test('disabled users cannot log in, refresh, or use a previously valid access token', async () => {
  const f = fixture()
  const tokens = await f.service.validateUser('review-user', hash('initial-password'))
  assert.equal(await f.accessAllowed(tokens.accessToken), true)
  await f.adminService.updateUser({ userId: 7, isActive: false })
  assert.equal(f.users.get(7).tokenVersion, 1)
  assert.equal((await f.service.validateUser('review-user', hash('initial-password'))).code, -1)
  assert.equal(await f.service.validateSsoToken(tokens.refreshToken), null)
  await assert.rejects(f.accessAllowed(tokens.accessToken), /会话已失效/)
  await f.adminService.updateUser({ userId: 7, isActive: true })
  assert.equal(await f.service.validateSsoToken(tokens.refreshToken), null, 'reenabling must not revive old sessions')
})

test('a deleted users refresh token cannot become a new account with the same username', async () => {
  const f = fixture()
  const tokens = await f.service.validateUser('review-user', hash('initial-password'))
  const prior = f.users.get(7)
  f.users.delete(7)
  f.users.set(99, { ...prior, userId: 99 })
  assert.equal(await f.service.validateSsoToken(tokens.refreshToken), null)
  await assert.rejects(f.accessAllowed(tokens.accessToken), /会话已失效/)
})

test('password changes revoke both tokens and new credentials can authenticate', async () => {
  const f = fixture()
  const tokens = await f.service.validateUser('review-user', hash('initial-password'))
  const changed = await f.service.changePassword(7, hash('initial-password'), 'changed-password')
  assert.equal(changed.code, 200)
  assert.equal(await f.service.validateSsoToken(tokens.refreshToken), null)
  await assert.rejects(f.accessAllowed(tokens.accessToken), /会话已失效/)
  const next = await f.service.validateUser('review-user', hash('changed-password'))
  assert.equal(await f.accessAllowed(next.accessToken), true)
})

test('admin reset revokes tokens even when the new password equals the old password', async () => {
  const f = fixture()
  const tokens = await f.service.validateUser('review-user', hash('initial-password'))
  await f.adminService.resetPassword(7, 'initial-password')
  assert.equal(await f.service.validateSsoToken(tokens.refreshToken), null)
  await assert.rejects(f.accessAllowed(tokens.accessToken), /会话已失效/)
})

test('legacy, malformed, and wrong-type tokens fail closed', async () => {
  const f = fixture()
  const legacy = f.jwt.sign({ userId: 7, username: 'review-user', tokenType: 'access' })
  await assert.rejects(f.accessAllowed(legacy), /会话已失效/)
  const refresh = f.auth.generateRefreshToken(7, 'review-user', 0)
  await assert.rejects(f.accessAllowed(refresh), /令牌无效/)
  assert.equal(await f.service.validateSsoToken(f.auth.generateAccessToken(7, 'review-user', 0)), null)
  for (const payload of [{}, { userId: 0, tokenVersion: 0 }, { userId: 7, tokenVersion: '0' }]) {
    assert.equal(await f.service.validateSession(payload), null)
  }
})
