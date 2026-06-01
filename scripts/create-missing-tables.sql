-- ============================================================
-- probe_x 数据库：缺失表的建表 SQL
-- 生成时间：2026-05-30
-- 字符集：utf8mb4
-- ============================================================

USE probe_x;

-- ============================================================
-- 1. project - 项目表
-- ============================================================
CREATE TABLE IF NOT EXISTS `project` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '项目唯一ID',
  `project_name` VARCHAR(100) NOT NULL COMMENT '项目名称',
  `project_key` VARCHAR(50) NOT NULL COMMENT '项目标识（全局唯一）',
  `description` VARCHAR(500) NULL COMMENT '项目描述',
  `is_enable` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用（1=启用，0=禁用）',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间（自动填充）',
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间（自动更新）',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `IDX_project_project_key` (`project_key`),
  INDEX `IDX_project_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目表：存储系统中的项目信息，用于多租户数据隔离';

-- ============================================================
-- 2. audit_log - 审计日志表
-- ============================================================
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '日志唯一ID',
  `user_id` BIGINT NULL COMMENT '操作用户ID',
  `username` VARCHAR(50) NOT NULL COMMENT '操作用户名',
  `action` VARCHAR(50) NOT NULL COMMENT '操作类型（如 create/update/delete）',
  `method` VARCHAR(10) NOT NULL COMMENT '请求方法（POST/PUT/DELETE）',
  `path` VARCHAR(500) NOT NULL COMMENT '请求路径',
  `request_body` TEXT NULL COMMENT '请求体摘要（JSON格式，敏感字段脱敏）',
  `response_status` INT NULL COMMENT '响应状态码',
  `ip` VARCHAR(50) NULL COMMENT 'IP地址',
  `user_agent` VARCHAR(500) NULL COMMENT 'User-Agent',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '操作时间（自动填充）',
  PRIMARY KEY (`id`),
  INDEX `IDX_audit_log_id` (`id`),
  INDEX `IDX_audit_log_user_id` (`user_id`),
  INDEX `IDX_audit_log_username` (`username`),
  INDEX `IDX_audit_log_action` (`action`),
  INDEX `IDX_audit_log_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审计日志表：记录系统中所有 API 写操作的审计日志';

-- ============================================================
-- 3. compute_node - 计算节点配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS `compute_node` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '节点唯一ID',
  `node_name` VARCHAR(100) NOT NULL COMMENT '节点名称',
  `node_address` VARCHAR(255) NOT NULL COMMENT '节点地址',
  `node_port` INT NOT NULL COMMENT '节点端口',
  `node_type` VARCHAR(20) NOT NULL DEFAULT 'grpc' COMMENT '节点类型（grpc）',
  `status` VARCHAR(20) NOT NULL DEFAULT 'stopped' COMMENT '节点状态（running/stopped/error）',
  `weight` INT NOT NULL DEFAULT 100 COMMENT '权重（用于负载均衡，默认100）',
  `description` VARCHAR(255) NULL COMMENT '描述',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间（自动填充）',
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间（自动更新）',
  PRIMARY KEY (`id`),
  INDEX `IDX_compute_node_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='计算节点配置表：存储系统中计算节点的注册配置信息';

-- ============================================================
-- 4. notification - 通知配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS `notification` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '通知配置唯一ID',
  `notification_name` VARCHAR(100) NOT NULL COMMENT '通知名称',
  `notification_type` VARCHAR(20) NOT NULL COMMENT '通知类型（webhook/email/sms）',
  `recipients` VARCHAR(500) NOT NULL COMMENT '接收人（邮箱地址、手机号、Webhook URL 等）',
  `trigger_condition` VARCHAR(500) NULL COMMENT '触发条件描述',
  `config` TEXT NOT NULL COMMENT '通知配置（JSON 格式）',
  `is_enable` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用（1=启用，0=禁用）',
  `last_send_time` DATETIME NULL COMMENT '最后发送时间',
  `description` VARCHAR(255) NULL COMMENT '描述',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间（自动填充）',
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间（自动更新）',
  PRIMARY KEY (`id`),
  INDEX `IDX_notification_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知配置表：存储系统中通知规则的配置信息';

-- ============================================================
-- 5. alert_rule - 告警规则表
-- ============================================================
CREATE TABLE IF NOT EXISTS `alert_rule` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '规则唯一ID',
  `rule_name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `rule_type` VARCHAR(50) NOT NULL COMMENT '规则类型（event_count_spike/funnel_conversion_drop/custom）',
  `condition` TEXT NOT NULL COMMENT '规则条件（JSON格式）',
  `project_id` BIGINT NULL COMMENT '关联项目ID',
  `notification_id` BIGINT NULL COMMENT '关联通知配置ID',
  `is_enable` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用（1=启用，0=禁用）',
  `description` VARCHAR(500) NULL COMMENT '描述',
  `last_trigger_time` DATETIME NULL COMMENT '最后触发时间',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间（自动填充）',
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间（自动更新）',
  PRIMARY KEY (`id`),
  INDEX `IDX_alert_rule_id` (`id`),
  INDEX `IDX_alert_rule_rule_type` (`rule_type`),
  INDEX `IDX_alert_rule_project_id` (`project_id`),
  CONSTRAINT `FK_alert_rule_project_id` FOREIGN KEY (`project_id`) REFERENCES `project` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `FK_alert_rule_notification_id` FOREIGN KEY (`notification_id`) REFERENCES `notification` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='告警规则表：存储系统中告警规则的配置信息';

-- ============================================================
-- 6. alert_history - 告警历史表
-- ============================================================
CREATE TABLE IF NOT EXISTS `alert_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '历史唯一ID',
  `alert_rule_id` BIGINT NOT NULL COMMENT '告警规则ID',
  `rule_name` VARCHAR(100) NOT NULL COMMENT '规则名称（冗余）',
  `alert_level` VARCHAR(20) NOT NULL COMMENT '告警级别（warning/critical）',
  `alert_content` TEXT NOT NULL COMMENT '告警内容',
  `notify_status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '通知状态（pending/sent/failed）',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '触发时间（自动填充）',
  PRIMARY KEY (`id`),
  INDEX `IDX_alert_history_id` (`id`),
  INDEX `IDX_alert_history_alert_rule_id` (`alert_rule_id`),
  INDEX `IDX_alert_history_alert_level` (`alert_level`),
  INDEX `IDX_alert_history_created_at` (`created_at`),
  CONSTRAINT `FK_alert_history_alert_rule_id` FOREIGN KEY (`alert_rule_id`) REFERENCES `alert_rule` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='告警历史表：记录每次告警触发的历史';

-- ============================================================
-- 7. user_project_relation - 用户-项目关联表
-- ============================================================
CREATE TABLE IF NOT EXISTS `user_project_relation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '关系唯一ID',
  `user_id` INT NOT NULL COMMENT '用户ID',
  `project_id` BIGINT NOT NULL COMMENT '项目ID',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间（自动填充）',
  PRIMARY KEY (`id`),
  INDEX `IDX_user_project_relation_id` (`id`),
  INDEX `IDX_user_project_relation_user_id` (`user_id`),
  INDEX `IDX_user_project_relation_project_id` (`project_id`),
  CONSTRAINT `FK_user_project_relation_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_user_project_relation_project_id` FOREIGN KEY (`project_id`) REFERENCES `project` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户-项目关联表：实现用户与项目的多对多关系';

-- ============================================================
-- 8. data_source - 数据源配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS `data_source` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '数据源唯一ID',
  `datasource_name` VARCHAR(100) NOT NULL COMMENT '数据源名称（唯一）',
  `datasource_type` VARCHAR(20) NOT NULL COMMENT '数据源类型（clickhouse/mysql/postgresql）',
  `host` VARCHAR(255) NOT NULL COMMENT '连接地址',
  `port` INT NOT NULL COMMENT '端口',
  `database_name` VARCHAR(100) NOT NULL COMMENT '数据库名',
  `username` VARCHAR(100) NULL COMMENT '用户名',
  `password` VARCHAR(255) NULL COMMENT '密码（加密存储）',
  `status` VARCHAR(20) NOT NULL DEFAULT 'unchecked' COMMENT '连接状态（normal/error/unchecked）',
  `last_check_time` DATETIME NULL COMMENT '最后检测时间',
  `description` VARCHAR(255) NULL COMMENT '描述',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间（自动填充）',
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间（自动更新）',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `IDX_data_source_datasource_name` (`datasource_name`),
  INDEX `IDX_data_source_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据源配置表：存储系统中各种数据源的连接配置信息';
