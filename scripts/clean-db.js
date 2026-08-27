/**
 * 清空 Probe-X 数据库，只保留角色权限和超管用户
 *
 * 数据库连接信息通过环境变量提供（缺省时直接报错退出）：
 *   DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_DATABASE(默认 probe_x)
 *
 * 执行 TRUNCATE 前必须显式设置 CONFIRM_CLEAN=YES 确认
 */
const mysql = require('mysql2/promise');

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE = 'probe_x' } = process.env;

function checkConfig() {
  const missing = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD'].filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`错误: 缺少环境变量 ${missing.join(', ')}，请先设置数据库连接信息`);
    process.exit(1);
  }
}

async function main() {
  checkConfig();

  console.log(`目标数据库: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`);

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
  });

  console.log('Connected to MySQL');

  // 查看所有表
  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0]);
  console.log('Tables:', tableNames.join(', '));

  // 需要保留的表（角色权限 + 超管用户相关）
  const keepTables = ['role', 'permission', 'role_permission_relation'];
  // 需要部分保留的表（user 表保留 admin 用户）
  const partialKeepTables = ['user', 'user_role_relation'];
  // 需要清空的表
  const clearTables = tableNames.filter(
    t => !keepTables.includes(t) && !partialKeepTables.includes(t)
  );

  console.log('\n=== 保留表（不清空）===');
  console.log(keepTables.join(', '));

  console.log('\n=== 部分保留表（保留 admin）===');
  console.log(partialKeepTables.join(', '));

  console.log('\n=== 要清空的表 ===');
  console.log(clearTables.join(', '));

  // 安全检查：执行 TRUNCATE 前需要显式确认
  if (process.env.CONFIRM_CLEAN !== 'YES') {
    console.error(`\n⚠️  即将清空 ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_DATABASE} 中的 ${clearTables.length} 张表`);
    console.error('如确认执行，请设置环境变量 CONFIRM_CLEAN=YES 后重试');
    await conn.end();
    process.exit(1);
  }

  // 禁用外键检查
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');

  // 清空表
  for (const table of clearTables) {
    await conn.query(`TRUNCATE TABLE \`${table}\``);
    console.log(`  ✓ Truncated: ${table}`);
  }

  // 处理 user 表：只保留 admin 用户
  const [adminUsers] = await conn.query(
    "SELECT id, username FROM user WHERE username = 'admin'"
  );
  if (adminUsers.length > 0) {
    const adminId = adminUsers[0].id;
    console.log(`\n保留 admin 用户 (id=${adminId}, username=${adminUsers[0].username})`);
    await conn.query('DELETE FROM user WHERE id != ?', [adminId]);
    // 保留 admin 的角色关联
    await conn.query('DELETE FROM user_role_relation WHERE user_id != ?', [adminId]);
    console.log(`  ✓ Cleaned user table, kept admin (id=${adminId})`);
  } else {
    console.log('\n⚠️  No admin user found, keeping all users');
  }

  // 重新启用外键检查
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  // 验证
  console.log('\n=== 清理后数据验证 ===');
  for (const table of tableNames) {
    const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
    console.log(`  ${table}: ${rows[0].cnt} rows`);
  }

  await conn.end();
  console.log('\n✅ 数据库清理完成');
}

main().catch(console.error);
