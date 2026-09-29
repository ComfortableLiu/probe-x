-- 在部署包含会话撤销功能的 API 之前，对现有 MySQL 数据库执行一次。
-- 无需启用 TypeORM synchronize；旧 JWT 将被拒绝，用户需要重新登录。
ALTER TABLE `user`
  ADD COLUMN `token_version` INT UNSIGNED NOT NULL DEFAULT 0
  COMMENT '账号凭证版本，改密或禁用时递增';
