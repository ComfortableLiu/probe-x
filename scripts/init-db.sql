-- Probe-X MySQL 数据库初始化脚本
-- 此脚本在 MySQL 容器首次启动时自动执行

-- 设置字符集
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS `probe_x` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `probe_x`;

-- ==================== 用户表 ====================
CREATE TABLE IF NOT EXISTS `user` (
  `user_id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名（唯一，用于登录）',
  `email` VARCHAR(100) NOT NULL UNIQUE COMMENT '邮箱地址（唯一）',
  `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希值',
  `nickname` VARCHAR(50) NOT NULL COMMENT '昵称（显示名称）',
  `is_active` BOOLEAN DEFAULT TRUE COMMENT '用户是否激活',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `last_login` DATETIME COMMENT '最后登录时间',
  INDEX `idx_username` (`username`),
  INDEX `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ==================== 角色表 ====================
CREATE TABLE IF NOT EXISTS `role` (
  `role_id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_name` VARCHAR(50) NOT NULL UNIQUE COMMENT '角色名称',
  `description` VARCHAR(200) COMMENT '角色描述',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- ==================== 用户角色关联表 ====================
CREATE TABLE IF NOT EXISTS `user_role_relation` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL COMMENT '用户ID',
  `role_id` INT NOT NULL COMMENT '角色ID',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  UNIQUE KEY `uk_user_role` (`user_id`, `role_id`),
  FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`role_id`) REFERENCES `role` (`role_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户角色关联表';

-- ==================== 权限表 ====================
CREATE TABLE IF NOT EXISTS `permission` (
  `permission_id` INT AUTO_INCREMENT PRIMARY KEY,
  `permission_name` VARCHAR(100) NOT NULL UNIQUE COMMENT '权限名称',
  `description` VARCHAR(200) COMMENT '权限描述',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表';

-- ==================== 项目表 ====================
CREATE TABLE IF NOT EXISTS `project` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `project_name` VARCHAR(100) NOT NULL COMMENT '项目名称',
  `project_key` VARCHAR(50) NOT NULL UNIQUE COMMENT '项目标识（全局唯一）',
  `description` VARCHAR(500) COMMENT '项目描述',
  `is_enable` TINYINT DEFAULT 1 COMMENT '是否启用（1=启用，0=禁用）',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  INDEX `idx_project_key` (`project_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目表';

-- ==================== 用户项目关联表 ====================
CREATE TABLE IF NOT EXISTS `user_project_relation` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL COMMENT '用户ID',
  `project_id` BIGINT NOT NULL COMMENT '项目ID',
  `role` VARCHAR(20) DEFAULT 'member' COMMENT '项目角色（owner/admin/member）',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  UNIQUE KEY `uk_user_project` (`user_id`, `project_id`),
  FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`project_id`) REFERENCES `project` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户项目关联表';

-- ==================== 数据源配置表 ====================
CREATE TABLE IF NOT EXISTS `data_source` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `datasource_name` VARCHAR(100) NOT NULL UNIQUE COMMENT '数据源名称',
  `datasource_type` VARCHAR(20) NOT NULL COMMENT '数据源类型（clickhouse/mysql/postgresql）',
  `host` VARCHAR(255) NOT NULL COMMENT '连接地址',
  `port` INT NOT NULL COMMENT '端口',
  `database_name` VARCHAR(100) NOT NULL COMMENT '数据库名',
  `username` VARCHAR(100) COMMENT '用户名',
  `password` VARCHAR(255) COMMENT '密码（加密存储）',
  `status` VARCHAR(20) DEFAULT 'unchecked' COMMENT '连接状态（normal/error/unchecked）',
  `last_check_time` DATETIME COMMENT '最后检测时间',
  `description` VARCHAR(255) COMMENT '描述',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据源配置表';

-- ==================== 埋点节点表 ====================
CREATE TABLE IF NOT EXISTS `tracking_node` (
  `code` VARCHAR(16) PRIMARY KEY COMMENT '节点编码',
  `type` ENUM('spm', 'scm') NOT NULL COMMENT '节点类型',
  `level` ENUM('1', '2', '3', '4') NOT NULL COMMENT '节点层级',
  `name` VARCHAR(100) NOT NULL COMMENT '节点名称',
  `description` VARCHAR(500) COMMENT '节点描述',
  `parent_code` VARCHAR(16) COMMENT '父节点编码',
  `status` ENUM('valid', 'invalid') DEFAULT 'valid' COMMENT '状态',
  `create_time` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `create_user_id` INT NOT NULL COMMENT '创建用户ID',
  `update_user_id` INT NOT NULL COMMENT '更新用户ID',
  `update_time` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  INDEX `idx_type` (`type`),
  INDEX `idx_level` (`level`),
  INDEX `idx_parent_code` (`parent_code`),
  FOREIGN KEY (`parent_code`) REFERENCES `tracking_node` (`code`) ON DELETE CASCADE,
  FOREIGN KEY (`create_user_id`) REFERENCES `user` (`user_id`),
  FOREIGN KEY (`update_user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='埋点节点表';

-- ==================== 仪表盘表 ====================
CREATE TABLE IF NOT EXISTS `dashboard` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL COMMENT '仪表盘名称',
  `description` VARCHAR(500) COMMENT '描述',
  `project_id` BIGINT NOT NULL COMMENT '所属项目ID',
  `config` JSON COMMENT '仪表盘配置',
  `is_public` BOOLEAN DEFAULT FALSE COMMENT '是否公开',
  `created_by` INT NOT NULL COMMENT '创建者ID',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  INDEX `idx_project_id` (`project_id`),
  FOREIGN KEY (`project_id`) REFERENCES `project` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='仪表盘表';

-- ==================== 告警规则表 ====================
CREATE TABLE IF NOT EXISTS `alert_rule` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `project_id` BIGINT NOT NULL COMMENT '所属项目ID',
  `metric` VARCHAR(100) NOT NULL COMMENT '监控指标',
  `condition` VARCHAR(50) NOT NULL COMMENT '触发条件（gt/lt/eq/gte/lte）',
  `threshold` DECIMAL(20, 4) NOT NULL COMMENT '阈值',
  `duration` INT DEFAULT 60 COMMENT '持续时间（秒）',
  `notification_channels` JSON COMMENT '通知渠道配置',
  `is_enabled` BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  `created_by` INT NOT NULL COMMENT '创建者ID',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  INDEX `idx_project_id` (`project_id`),
  FOREIGN KEY (`project_id`) REFERENCES `project` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='告警规则表';

-- ==================== 告警历史表 ====================
CREATE TABLE IF NOT EXISTS `alert_history` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `rule_id` BIGINT NOT NULL COMMENT '规则ID',
  `project_id` BIGINT NOT NULL COMMENT '项目ID',
  `metric_value` DECIMAL(20, 4) COMMENT '触发时的指标值',
  `status` ENUM('firing', 'resolved') DEFAULT 'firing' COMMENT '状态',
  `fired_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '触发时间',
  `resolved_at` DATETIME(3) COMMENT '恢复时间',
  INDEX `idx_rule_id` (`rule_id`),
  INDEX `idx_project_id` (`project_id`),
  FOREIGN KEY (`rule_id`) REFERENCES `alert_rule` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`project_id`) REFERENCES `project` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='告警历史表';

-- ==================== 通知表 ====================
CREATE TABLE IF NOT EXISTS `notification` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL COMMENT '用户ID',
  `title` VARCHAR(200) NOT NULL COMMENT '通知标题',
  `content` TEXT COMMENT '通知内容',
  `type` VARCHAR(50) COMMENT '通知类型',
  `is_read` BOOLEAN DEFAULT FALSE COMMENT '是否已读',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_is_read` (`is_read`),
  FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知表';

-- ==================== 审计日志表 ====================
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT COMMENT '操作用户ID',
  `action` VARCHAR(50) NOT NULL COMMENT '操作类型',
  `resource_type` VARCHAR(50) COMMENT '资源类型',
  `resource_id` VARCHAR(100) COMMENT '资源ID',
  `details` JSON COMMENT '操作详情',
  `ip_address` VARCHAR(45) COMMENT 'IP地址',
  `user_agent` VARCHAR(500) COMMENT '用户代理',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_action` (`action`),
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审计日志表';

-- ==================== 计算节点表 ====================
CREATE TABLE IF NOT EXISTS `compute_node` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `node_id` VARCHAR(100) NOT NULL UNIQUE COMMENT '节点唯一标识',
  `node_name` VARCHAR(100) COMMENT '节点名称',
  `status` ENUM('online', 'offline', 'busy') DEFAULT 'offline' COMMENT '节点状态',
  `last_heartbeat` DATETIME(3) COMMENT '最后心跳时间',
  `capabilities` JSON COMMENT '节点能力配置',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='计算节点表';

-- ==================== 数据分析任务日志表 ====================
CREATE TABLE IF NOT EXISTS `data_analysis_task_log` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `task_id` VARCHAR(100) NOT NULL COMMENT '任务ID',
  `project_id` BIGINT NOT NULL COMMENT '项目ID',
  `task_type` VARCHAR(50) NOT NULL COMMENT '任务类型',
  `status` ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending' COMMENT '任务状态',
  `progress` INT DEFAULT 0 COMMENT '进度（0-100）',
  `result` JSON COMMENT '任务结果',
  `error_message` TEXT COMMENT '错误信息',
  `started_at` DATETIME(3) COMMENT '开始时间',
  `completed_at` DATETIME(3) COMMENT '完成时间',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  INDEX `idx_task_id` (`task_id`),
  INDEX `idx_project_id` (`project_id`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`project_id`) REFERENCES `project` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据分析任务日志表';

-- ==================== 初始化数据 ====================

-- 插入默认角色
INSERT IGNORE INTO `role` (`role_name`, `description`) VALUES
  ('admin', '系统管理员'),
  ('user', '普通用户');

-- 插入默认管理员用户（密码: admin123，实际使用时请修改）
-- 密码哈希值需要在应用层生成，这里使用占位符
INSERT IGNORE INTO `user` (`username`, `email`, `password_hash`, `nickname`, `is_active`) VALUES
  ('admin', 'admin@probe-x.com', '$2b$10$placeholder_hash_here', '系统管理员', TRUE);

-- 为管理员分配角色
INSERT IGNORE INTO `user_role_relation` (`user_id`, `role_id`)
SELECT u.user_id, r.role_id
FROM `user` u, `role` r
WHERE u.username = 'admin' AND r.role_name = 'admin';

-- 完成提示
SELECT 'Probe-X 数据库初始化完成！' AS message;
