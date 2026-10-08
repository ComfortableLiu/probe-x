-- ============================================================
-- probe_x 数据库：缺失表的建表 SQL
-- 生成时间：2026-05-30
-- 字符集：utf8mb4
-- ============================================================

USE probe_x;

-- ============================================================
-- 1. audit_log - 审计日志表
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
-- 2. compute_node - 计算节点配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS `compute_node` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '节点唯一ID',
  `node_id` VARCHAR(100) NULL UNIQUE COMMENT '节点自报标识（自动注册的节点以此字段幂等 upsert）',
  `node_name` VARCHAR(100) NOT NULL COMMENT '节点名称',
  `node_address` VARCHAR(255) NOT NULL COMMENT '节点地址',
  `node_port` INT NULL DEFAULT 0 COMMENT '节点端口（拨出接入的计算节点无监听端口，允许为空）',
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
-- 3. alert_rule - 告警规则表
-- ============================================================
CREATE TABLE IF NOT EXISTS `alert_rule` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '规则唯一ID',
  `name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `event_name` VARCHAR(100) NOT NULL COMMENT '监控事件名称',
  `window_minutes` INT NOT NULL DEFAULT 60 COMMENT '统计时间窗（分钟）',
  `check_interval_minutes` INT NOT NULL DEFAULT 5 COMMENT '巡检间隔（分钟）',
  `operator` VARCHAR(4) NOT NULL COMMENT '比较运算符（>/</>=/<=/==）',
  `threshold` DOUBLE NOT NULL COMMENT '阈值',
  `level` VARCHAR(20) NOT NULL DEFAULT 'warning' COMMENT '告警级别（info/warning/critical）',
  `webhook_url` VARCHAR(500) NOT NULL COMMENT '告警通知 Webhook 地址',
  `enabled` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用（1=启用，0=禁用）',
  `last_checked_at` DATETIME NULL COMMENT '最后巡检时间',
  `last_triggered_at` DATETIME NULL COMMENT '最后触发时间',
  `create_user_id` INT NULL COMMENT '创建者ID',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间（自动填充）',
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间（自动更新）',
  PRIMARY KEY (`id`),
  INDEX `IDX_alert_rule_id` (`id`),
  INDEX `IDX_alert_rule_event_name` (`event_name`),
  INDEX `IDX_alert_rule_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='告警规则表：存储阈值告警规则的配置信息';

-- ============================================================
-- 4. alert_history - 告警历史表
-- ============================================================
CREATE TABLE IF NOT EXISTS `alert_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '历史唯一ID',
  `rule_id` BIGINT NOT NULL COMMENT '告警规则ID',
  `metric_value` DOUBLE NULL COMMENT '触发时的指标值',
  `threshold` DOUBLE NOT NULL COMMENT '触发时的阈值',
  `level` VARCHAR(20) NOT NULL COMMENT '告警级别（info/warning/critical）',
  `webhook_status` VARCHAR(20) NOT NULL COMMENT 'Webhook 发送结果（success/failed）',
  `error` TEXT NULL COMMENT '失败原因',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '触发时间（自动填充）',
  PRIMARY KEY (`id`),
  INDEX `IDX_alert_history_id` (`id`),
  INDEX `IDX_alert_history_rule_id` (`rule_id`),
  INDEX `IDX_alert_history_level` (`level`),
  INDEX `IDX_alert_history_created_at` (`created_at`),
  CONSTRAINT `FK_alert_history_rule_id` FOREIGN KEY (`rule_id`) REFERENCES `alert_rule` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='告警历史表：记录每次告警触发及 Webhook 通知结果';

-- ==================== 通用配置表 ====================
-- 通用 KV 形态：一行一个全局配置项，当前用于最终数据清洗调度（final_cleaning.*）。
CREATE TABLE IF NOT EXISTS `system_config` (
  `key` VARCHAR(100) PRIMARY KEY COMMENT '配置键，如 final_cleaning.daily_time',
  `value` TEXT NULL COMMENT '配置值',
  `description` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '配置描述',
  `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通用配置表：一行一个全局配置项';
