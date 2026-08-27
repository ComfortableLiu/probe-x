#!/usr/bin/env node
/**
 * Probe-X admin 密码初始化脚本
 *
 * 用途：设置/重置 admin 用户的登录密码。
 * 背景：init-db.sql 插入的 admin 用户使用的是占位哈希，无法直接登录；
 *       登录接口在 admin 密码为空时会提示"请先通过初始化脚本设置密码"，即本脚本。
 *
 * 用法：
 *   node scripts/init-admin-password.js                  # 使用默认初始密码 admin123
 *   node scripts/init-admin-password.js --password=xxx   # 指定初始密码
 *   ADMIN_PASSWORD=xxx node scripts/init-admin-password.js
 *
 * 环境变量（自动加载 apps/data-dashboard-api-service/config/env/ 下的 .env* 文件）：
 *   DB_HOST / DB_PORT / DB_USER（或 DB_USERNAME）/ DB_PASSWORD / DB_DATABASE(默认 probe_x)
 *   SALT / HMAC_SECRET  —— 必须与 data-dashboard-api-service 的运行配置一致，否则密码校验不通过
 */
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const mysql = require('mysql2/promise')

const DEFAULT_PASSWORD = 'admin123'

// 与服务端 env-config.module.ts 相同的加载优先级
const nodeEnv = process.env.NODE_ENV || 'development'
const envDir = path.join(__dirname, '../apps/data-dashboard-api-service/config/env')
try {
  const dotenv = require('dotenv')
  for (const f of [`.env.${nodeEnv}.local`, '.env.local', `.env.${nodeEnv}`, '.env']) {
    const p = path.join(envDir, f)
    if (fs.existsSync(p)) dotenv.config({ path: p, override: false })
  }
} catch {
  // dotenv 不可用时仅依赖外部环境变量
}

const argPassword = (process.argv.find(a => a.startsWith('--password=')) || '').split('=')[1]
const adminPassword = argPassword || process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD

// 与登录校验链路一致的双重哈希：
//   前端：frontHash  = HMAC-SHA512(key=HMAC_SECRET, 明文 + SALT)
//   服务端：storedHash = HMAC-SHA512(key=HMAC_SECRET, frontHash + SALT)
const hmacSha512 = (text, key) => crypto.createHmac('sha512', key).update(text).digest('hex')

async function main() {
  const { SALT, HMAC_SECRET } = process.env
  const missing = ['SALT', 'HMAC_SECRET'].filter(k => !process.env[k])
  if (missing.length > 0) {
    console.error(`❌ 缺少环境变量: ${missing.join(', ')}（需与 data-dashboard-api-service 配置一致）`)
    process.exit(1)
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'probe_x',
  })

  const passwordHash = hmacSha512(hmacSha512(adminPassword + SALT, HMAC_SECRET) + SALT, HMAC_SECRET)

  const [users] = await conn.query('SELECT user_id FROM `user` WHERE username = ?', ['admin'])
  if (users.length > 0) {
    await conn.query('UPDATE `user` SET password_hash = ? WHERE username = ?', [passwordHash, 'admin'])
    console.log(`✅ admin 密码已更新（user_id=${users[0].user_id}）`)
  } else {
    await conn.query(
      'INSERT INTO `user` (`username`, `email`, `password_hash`, `nickname`, `is_active`) VALUES (?, ?, ?, ?, TRUE)',
      ['admin', 'admin@probe-x.com', passwordHash, '系统管理员'],
    )
    // 绑定 admin 角色（角色存在时）
    const [roles] = await conn.query('SELECT role_id FROM `role` WHERE role_name = ?', ['admin'])
    if (roles.length > 0) {
      const [adminUser] = await conn.query('SELECT user_id FROM `user` WHERE username = ?', ['admin'])
      await conn.query(
        'INSERT IGNORE INTO `user_role_relation` (`user_id`, `role_id`) VALUES (?, ?)',
        [adminUser[0].user_id, roles[0].role_id],
      )
    }
    console.log('✅ admin 用户不存在，已创建并设置密码')
  }

  await conn.end()

  if (adminPassword === DEFAULT_PASSWORD) {
    console.log(`\n⚠️  本次使用的是默认初始密码: ${DEFAULT_PASSWORD}，请登录后立即修改！`)
    console.log('   自定义初始密码: node scripts/init-admin-password.js --password=<你的密码>')
  } else {
    console.log('\n✅ 已使用自定义密码完成初始化')
  }
}

main().catch(e => {
  console.error('❌ 初始化失败:', e.message)
  process.exit(1)
})
