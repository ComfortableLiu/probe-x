# 数据分析日志表结构设计

## 1. 数据分析任务日志表 (data_analysis_task_log)

用于记录数据分析任务的执行情况。

```sql
CREATE TABLE `data_analysis_task_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `task_id` varchar(64) NOT NULL COMMENT '任务唯一标识',
  `task_name` varchar(255) NOT NULL COMMENT '任务名称',
  `initiator_id` int(11) NOT NULL COMMENT '发起任务用户ID',
  `initiator_name` varchar(100) NOT NULL COMMENT '发起任务用户名',
  `query_content` text COMMENT '查询内容或SQL语句',
  `status` tinyint(4) NOT NULL DEFAULT '0' COMMENT '任务状态: 0-排队中, 1-计算中, 2-已完成, 3-已终止',
  `start_time` datetime DEFAULT NULL COMMENT '任务开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '任务结束时间',
  `duration` int(11) DEFAULT NULL COMMENT '任务执行耗时(秒)',
  `result_size` int(11) DEFAULT NULL COMMENT '结果数据量',
  `result_path` varchar(500) DEFAULT NULL COMMENT '结果存储路径',
  `error_msg` text COMMENT '错误信息',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_id` (`task_id`),
  KEY `idx_initiator_id` (`initiator_id`),
  KEY `idx_status` (`status`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据分析任务日志表';
```

## 2. 数据分析查询统计表 (data_analysis_query_stats)

用于统计数据分析功能的使用情况。

```sql
CREATE TABLE `data_analysis_query_stats` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `query_date` date NOT NULL COMMENT '查询日期',
  `user_id` int(11) NOT NULL COMMENT '查询用户ID',
  `user_name` varchar(100) NOT NULL COMMENT '查询用户名',
  `query_content` text COMMENT '查询内容',
  `query_time` datetime NOT NULL COMMENT '查询时间',
  `query_duration` int(11) NOT NULL COMMENT '查询耗时(毫秒)',
  `result_size` int(11) DEFAULT NULL COMMENT '结果数据量',
  `is_success` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否成功: 0-失败, 1-成功',
  `error_msg` text COMMENT '错误信息',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date_user_time` (`query_date`, `user_id`, `query_time`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_query_date` (`query_date`),
  KEY `idx_query_time` (`query_time`),
  KEY `idx_is_success` (`is_success`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据分析查询统计表';
```

## 3. 数据分析导出记录表 (data_analysis_export_log)

用于记录数据分析结果的导出情况。

```sql
CREATE TABLE `data_analysis_export_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `export_id` varchar(64) NOT NULL COMMENT '导出记录唯一标识',
  `user_id` int(11) NOT NULL COMMENT '导出用户ID',
  `user_name` varchar(100) NOT NULL COMMENT '导出用户名',
  `export_type` varchar(50) NOT NULL COMMENT '导出类型: csv, excel, pdf, json等',
  `export_content` text COMMENT '导出内容描述',
  `export_params` json DEFAULT NULL COMMENT '导出参数',
  `file_path` varchar(500) DEFAULT NULL COMMENT '导出文件路径',
  `file_size` bigint(20) DEFAULT NULL COMMENT '文件大小(字节)',
  `status` tinyint(4) NOT NULL DEFAULT '0' COMMENT '导出状态: 0-处理中, 1-已完成, 2-失败',
  `start_time` datetime DEFAULT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `duration` int(11) DEFAULT NULL COMMENT '导出耗时(秒)',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_export_id` (`export_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_export_type` (`export_type`),
  KEY `idx_status` (`status`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据分析导出记录表';
```

## 4. 数据分析功能访问统计表 (data_analysis_access_stats)

用于统计数据分析功能的访问情况。

```sql
CREATE TABLE `data_analysis_access_stats` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `access_date` date NOT NULL COMMENT '访问日期',
  `user_id` int(11) NOT NULL COMMENT '访问用户ID',
  `user_name` varchar(100) NOT NULL COMMENT '访问用户名',
  `access_time` datetime NOT NULL COMMENT '访问时间',
  `access_type` varchar(50) NOT NULL COMMENT '访问类型: page_view, api_call等',
  `access_path` varchar(500) NOT NULL COMMENT '访问路径',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` varchar(500) DEFAULT NULL COMMENT '用户代理',
  `session_id` varchar(128) DEFAULT NULL COMMENT '会话ID',
  `page_stay_duration` int(11) DEFAULT NULL COMMENT '页面停留时长(秒)',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_access_date` (`access_date`),
  KEY `idx_access_time` (`access_time`),
  KEY `idx_access_type` (`access_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据分析功能访问统计表';
```

## 说明

1. 这些表设计遵循了数据库设计最佳实践，包含适当的索引以提高查询性能
2. 使用了合适的数据类型和长度限制
3. 添加了详细的注释说明每个字段的用途
4. 根据[数据源使用规范](memory://5cc22a97-a72c-41e7-aaed-112705b08ea5)中的要求，仅在必要场景（如记录查询次数、操作日志等）方可新建表
5. 表结构涵盖了数据分析功能的主要使用场景：任务执行、查询统计、结果导出和访问统计