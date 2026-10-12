-- Probe-X ClickHouse 数据库初始化脚本
-- 此脚本在 ClickHouse 容器首次启动时自动执行
--
-- 注意：本脚本均为 CREATE TABLE IF NOT EXISTS，已存在旧版表结构的环境不会自动迁移。
-- 旧版宽表/KV 表（如含 source_page_id / attribution_index 列的旧版 event_attribution，
-- 以及重构前的 event_log / final_event_log）需手动 DROP 后重建（表内无生产数据）。

-- 创建数据库
CREATE DATABASE IF NOT EXISTS probe_x;

-- 使用数据库
USE probe_x;

-- ==================== 原始事件日志表 ====================
-- 存储从埋点接收服务写入的原始事件数据
-- 分区说明：PARTITION BY toDate($service_time) 按天分区，分析查询绝大多数按
-- 「某一天/某几天」过滤（toDate($service_time) 或 $service_time BETWEEN），
-- 按天分区可直接做分区级裁剪，TTL 到期也可整天 DROP PARTITION
-- 索引说明：ORDER BY 排序键即主键稀疏索引（$service_time 在首位，日期范围查询
-- 直接走主键），跳数索引只补高频等值过滤字段；$service_time 不再建 minmax
-- （主键首列已天然具备 minmax 裁剪，建了是冗余）
-- 去重说明：ORDER BY 排序键 ($service_time, $session_id, $event_name) 与去重键 $event_id 不兼容
-- （SDK 重试会产生新的 $service_time，无法用 ReplacingMergeTree 按排序键合并去重），
-- 因此保持 MergeTree，端到端幂等依赖消费端 preliminary-data-processing-service 的
-- Redis SET NX 去重（dedup:event:{$event_id}），本表仅持久化 $event_id 便于排查
CREATE TABLE IF NOT EXISTS event_log (
    -- 事件基础信息
    `$event_id` String DEFAULT '' COMMENT '事件唯一标识（SDK 生成的 uuid，端到端幂等去重键）',
    `$event_name` LowCardinality(String) COMMENT '事件名称（如 page_view, click, route_change）',
    `$log_time` DateTime64(3) COMMENT '客户端日志时间',
    `$service_time` DateTime64(3) COMMENT '服务端接收时间',

    -- 网络信息
    `$ip` String DEFAULT '' COMMENT '客户端 IP 地址',
    `$web_site` LowCardinality(String) DEFAULT '' COMMENT '网站域名',

    -- 页面信息
    `$web_pathname` LowCardinality(String) DEFAULT '' COMMENT '页面路径',
    `$web_params` String DEFAULT '' COMMENT '页面参数',
    `$page_id` String DEFAULT '' COMMENT '页面唯一标识',
    `$source_page_id` String DEFAULT '' COMMENT '来源页面标识',
    `$target_page_id` String DEFAULT '' COMMENT '目标页面标识（路由跳转时）',

    -- 设备信息
    `$device_id` String DEFAULT '' COMMENT '设备唯一标识',
    `$uid` UInt64 DEFAULT 0 COMMENT '用户ID',
    `$device` LowCardinality(String) DEFAULT '' COMMENT '设备类型（desktop/mobile/tablet）',
    `$language` LowCardinality(String) DEFAULT '' COMMENT '浏览器语言',
    `$ua` String DEFAULT '' COMMENT 'User-Agent',
    `$screen_width` UInt32 DEFAULT 0 COMMENT '屏幕宽度',
    `$screen_height` UInt32 DEFAULT 0 COMMENT '屏幕高度',
    `$viewport_width` UInt32 DEFAULT 0 COMMENT '视口宽度',
    `$viewport_height` UInt32 DEFAULT 0 COMMENT '视口高度',
    `$device_pixel_ratio` Float32 DEFAULT 1 COMMENT '设备像素比',
    `$scroll_height` UInt32 DEFAULT 0 COMMENT '页面滚动高度',

    -- UTM 参数
    `$utm_source` String DEFAULT '' COMMENT 'UTM 来源',
    `$utm_campaign` String DEFAULT '' COMMENT 'UTM 活动',
    `$utm_medium` String DEFAULT '' COMMENT 'UTM 媒介',
    `$utm_content` String DEFAULT '' COMMENT 'UTM 内容',
    `$utm_term` String DEFAULT '' COMMENT 'UTM 关键词',

    -- 来源信息
    `$referrer` String DEFAULT '' COMMENT '页面来源',
    `$zoon` Int8 DEFAULT 8 COMMENT '时区偏移',

    -- 元素信息
    `$element_id` String DEFAULT '' COMMENT '触发事件的元素ID',

    -- SPM 参数（超级位置模型）
    `$spm` String DEFAULT '' COMMENT 'SPM 完整编码',
    `$spm_a` LowCardinality(String) DEFAULT '' COMMENT 'SPM 第一层',
    `$spm_b` LowCardinality(String) DEFAULT '' COMMENT 'SPM 第二层',
    `$spm_c` String DEFAULT '' COMMENT 'SPM 第三层',
    `$spm_d` String DEFAULT '' COMMENT 'SPM 第四层',
    `$spm_a_description` String DEFAULT '' COMMENT 'SPM 第一层描述',
    `$spm_b_description` String DEFAULT '' COMMENT 'SPM 第二层描述',
    `$spm_c_description` String DEFAULT '' COMMENT 'SPM 第三层描述',
    `$spm_d_description` String DEFAULT '' COMMENT 'SPM 第四层描述',

    -- SCM 参数（超级来源模型）
    `$scm` String DEFAULT '' COMMENT 'SCM 完整编码',
    `$scm_a` LowCardinality(String) DEFAULT '' COMMENT 'SCM 第一层',
    `$scm_b` LowCardinality(String) DEFAULT '' COMMENT 'SCM 第二层',
    `$scm_c` String DEFAULT '' COMMENT 'SCM 第三层',
    `$scm_d` String DEFAULT '' COMMENT 'SCM 第四层',
    `$scm_a_description` String DEFAULT '' COMMENT 'SCM 第一层描述',
    `$scm_b_description` String DEFAULT '' COMMENT 'SCM 第二层描述',
    `$scm_c_description` String DEFAULT '' COMMENT 'SCM 第三层描述',
    `$scm_d_description` String DEFAULT '' COMMENT 'SCM 第四层描述',

    -- 会话信息
    `$session_id` String DEFAULT '' COMMENT '会话唯一标识',

    -- 归因信息
    `$is_attribution_event` Bool DEFAULT false COMMENT '是否是归因事件',
    `$ex_attribution_params` String DEFAULT '' COMMENT '扩展归因参数（JSON格式）',

    -- 跳数索引（主键稀疏索引之外的补充，只覆盖高频等值过滤字段）
    INDEX idx_event_name `$event_name` TYPE set(100) GRANULARITY 1,
    INDEX idx_session_id `$session_id` TYPE bloom_filter GRANULARITY 1,
    INDEX idx_device_id `$device_id` TYPE bloom_filter GRANULARITY 1,
    INDEX idx_page_id `$page_id` TYPE bloom_filter GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toDate(`$service_time`)
ORDER BY (`$service_time`, `$session_id`, `$event_name`)
TTL `$service_time` + INTERVAL 365 DAY
SETTINGS index_granularity = 8192;

-- ==================== 清洗后事件日志表 ====================
-- 存储经过 final-data-cleaning-service 处理后的事件数据
-- 去重说明：任务重复下发的幂等由 final-data-cleaning-service 的 Redis SET NX
-- （clean:task:{task_id}）保证，本表保持 MergeTree
CREATE TABLE IF NOT EXISTS final_event_log (
    -- 事件基础信息
    `$event_id` String DEFAULT '' COMMENT '事件唯一标识（继承自 event_log，端到端幂等去重键）',
    `$event_name` LowCardinality(String) COMMENT '事件名称',
    `$log_time` DateTime64(3) COMMENT '客户端日志时间',
    `$service_time` DateTime64(3) COMMENT '服务端接收时间',

    -- 网络信息
    `$ip` String DEFAULT '' COMMENT '客户端 IP 地址',
    `$web_site` LowCardinality(String) DEFAULT '' COMMENT '网站域名',

    -- 页面信息
    `$web_pathname` LowCardinality(String) DEFAULT '' COMMENT '页面路径',
    `$web_params` String DEFAULT '' COMMENT '页面参数',
    `$page_id` String DEFAULT '' COMMENT '页面唯一标识',
    `$source_page_id` String DEFAULT '' COMMENT '来源页面标识',
    `$target_page_id` String DEFAULT '' COMMENT '目标页面标识',

    -- 设备信息
    `$device_id` String DEFAULT '' COMMENT '设备唯一标识',
    `$uid` UInt64 DEFAULT 0 COMMENT '用户ID',
    `$device` LowCardinality(String) DEFAULT '' COMMENT '设备类型',
    `$language` LowCardinality(String) DEFAULT '' COMMENT '浏览器语言',
    `$ua` String DEFAULT '' COMMENT 'User-Agent',
    `$screen_width` UInt32 DEFAULT 0 COMMENT '屏幕宽度',
    `$screen_height` UInt32 DEFAULT 0 COMMENT '屏幕高度',
    `$viewport_width` UInt32 DEFAULT 0 COMMENT '视口宽度',
    `$viewport_height` UInt32 DEFAULT 0 COMMENT '视口高度',
    `$device_pixel_ratio` Float32 DEFAULT 1 COMMENT '设备像素比',
    `$scroll_height` UInt32 DEFAULT 0 COMMENT '页面滚动高度',

    -- UTM 参数
    `$utm_source` String DEFAULT '' COMMENT 'UTM 来源',
    `$utm_campaign` String DEFAULT '' COMMENT 'UTM 活动',
    `$utm_medium` String DEFAULT '' COMMENT 'UTM 媒介',
    `$utm_content` String DEFAULT '' COMMENT 'UTM 内容',
    `$utm_term` String DEFAULT '' COMMENT 'UTM 关键词',

    -- 来源信息
    `$referrer` String DEFAULT '' COMMENT '页面来源',
    `$zoon` Int8 DEFAULT 8 COMMENT '时区偏移',

    -- 元素信息
    `$element_id` String DEFAULT '' COMMENT '触发事件的元素ID',

    -- SPM 参数
    `$spm` String DEFAULT '' COMMENT 'SPM 完整编码',
    `$spm_a` LowCardinality(String) DEFAULT '' COMMENT 'SPM 第一层',
    `$spm_b` LowCardinality(String) DEFAULT '' COMMENT 'SPM 第二层',
    `$spm_c` String DEFAULT '' COMMENT 'SPM 第三层',
    `$spm_d` String DEFAULT '' COMMENT 'SPM 第四层',
    `$spm_a_description` String DEFAULT '' COMMENT 'SPM 第一层描述',
    `$spm_b_description` String DEFAULT '' COMMENT 'SPM 第二层描述',
    `$spm_c_description` String DEFAULT '' COMMENT 'SPM 第三层描述',
    `$spm_d_description` String DEFAULT '' COMMENT 'SPM 第四层描述',

    -- SCM 参数
    `$scm` String DEFAULT '' COMMENT 'SCM 完整编码',
    `$scm_a` LowCardinality(String) DEFAULT '' COMMENT 'SCM 第一层',
    `$scm_b` LowCardinality(String) DEFAULT '' COMMENT 'SCM 第二层',
    `$scm_c` String DEFAULT '' COMMENT 'SCM 第三层',
    `$scm_d` String DEFAULT '' COMMENT 'SCM 第四层',
    `$scm_a_description` String DEFAULT '' COMMENT 'SCM 第一层描述',
    `$scm_b_description` String DEFAULT '' COMMENT 'SCM 第二层描述',
    `$scm_c_description` String DEFAULT '' COMMENT 'SCM 第三层描述',
    `$scm_d_description` String DEFAULT '' COMMENT 'SCM 第四层描述',

    -- 会话信息
    `$session_id` String DEFAULT '' COMMENT '会话唯一标识',

    -- 归因信息
    `$is_attribution_event` Bool DEFAULT false COMMENT '是否是归因事件',
    `$ex_attribution_params` String DEFAULT '' COMMENT '扩展归因参数',

    -- 跳数索引
    INDEX idx_event_name `$event_name` TYPE set(100) GRANULARITY 1,
    INDEX idx_session_id `$session_id` TYPE bloom_filter GRANULARITY 1,
    INDEX idx_device_id `$device_id` TYPE bloom_filter GRANULARITY 1,
    INDEX idx_page_id `$page_id` TYPE bloom_filter GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toDate(`$service_time`)
ORDER BY (`$service_time`, `$session_id`, `$event_name`)
TTL `$service_time` + INTERVAL 730 DAY
SETTINGS index_granularity = 8192;

-- ==================== 事件归因表 ====================
-- 事件归因 KV 子表（动态归因属性存储），由 final-data-cleaning-service 写入。
-- 与 libs/shared-types/src/lib/types/clickhouse/entity/Attribution.ts 保持一致。
-- 只存归因事件（final_event_log.$is_attribution_event = true）的扩展归因参数
-- （$ex_attribution_params 解析后的键值对）；SPM/SCM 标准字段已是 final_event_log 的列，
-- 不再写入本表。通过 event_id 与 final_event_log.$event_id 精确关联，
-- 归因链由查询侧按 session 内时间前缀动态拼装。
-- event_time 在排序键第二位，主键稀疏索引天然具备 minmax 裁剪，不再单独建跳数索引
CREATE TABLE IF NOT EXISTS event_attribution (
    `event_id` String COMMENT '归因事件的 $event_id，用于与 final_event_log 精确关联',
    `session_id` String COMMENT '会话唯一标识，对应 final_event_log.$session_id',
    `attr_key` LowCardinality(String) COMMENT '归因属性名（camelCase，保留 $ 前缀）',
    `attr_value` String COMMENT '归因属性值',
    `event_time` DateTime64(3) COMMENT '归因事件的 $service_time，用于分区对齐，对应 final_event_log.$service_time'
) ENGINE = MergeTree()
PARTITION BY toDate(event_time)
ORDER BY (session_id, event_time, attr_key)
TTL event_time + INTERVAL 730 DAY
SETTINGS index_granularity = 8192
COMMENT '事件归因KV子表（动态归因属性存储）';

-- ==================== 创建物化视图（可选） ====================
-- 按天聚合的事件统计物化视图
CREATE MATERIALIZED VIEW IF NOT EXISTS event_daily_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (day, `$event_name`, `$page_id`)
AS SELECT
    toDate(`$service_time`) AS day,
    `$event_name`,
    `$page_id`,
    `$web_site`,
    count() AS event_count,
    uniq(`$device_id`) AS unique_devices,
    uniq(`$session_id`) AS unique_sessions,
    uniq(`$uid`) AS unique_users
FROM event_log
GROUP BY
    day,
    `$event_name`,
    `$page_id`,
    `$web_site`;

-- ==================== 创建用户访问统计表 ====================
CREATE TABLE IF NOT EXISTS user_visit_stats (
    `$date` Date COMMENT '日期',
    `$web_site` String DEFAULT '' COMMENT '网站域名',
    `$device_id` String DEFAULT '' COMMENT '设备ID',
    `$uid` UInt64 DEFAULT 0 COMMENT '用户ID',
    `$session_id` String DEFAULT '' COMMENT '会话ID',
    `page_view_count` UInt32 DEFAULT 0 COMMENT '页面浏览次数',
    `first_visit_time` DateTime64(3) COMMENT '首次访问时间',
    `last_visit_time` DateTime64(3) COMMENT '最后访问时间',
    INDEX idx_date `$date` TYPE minmax GRANULARITY 1,
    INDEX idx_device_id `$device_id` TYPE bloom_filter GRANULARITY 1
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(`$date`)
ORDER BY (`$date`, `$web_site`, `$device_id`, `$uid`, `$session_id`)
SETTINGS index_granularity = 8192;

-- 完成提示
SELECT 'Probe-X ClickHouse 数据库初始化完成！' AS message;
