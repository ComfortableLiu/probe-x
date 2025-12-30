# Probe-X 埋点与数据分析系统架构

## 系统概述

Probe-X 是一个大型埋点与数据分析系统，采用微服务架构，包含前端和多个后端服务，支持实时数据处理和分析。

## 系统架构

### 服务组件

1. **前端服务 (frontend)**
   - 技术栈: React + TypeScript + Rspack
   - 端口: 8000
   - 功能: 数据可视化仪表板，埋点管理界面

2. **埋点接收服务 (receiving-point-service)**
   - 技术栈: NestJS + TypeORM + MySQL
   - 端口: 3004
   - 功能: 接收原始埋点数据，存储到数据库，发送到Kafka

3. **数据仪表板API服务 (data-dashboard-api-service)**
   - 技术栈: NestJS + TypeORM + MySQL + Kafka
   - 端口: 3001
   - 功能: 提供仪表板数据API，实时数据统计，分析报告

4. **初步数据处理服务 (preliminary-data-processing-service)**
   - 技术栈: NestJS + TypeORM + MySQL + Kafka
   - 端口: 3003
   - 功能: 数据清洗，数据增强，异常检测

5. **最终数据清洗服务 (final-data-cleaning-service)**
   - 技术栈: NestJS + TypeORM + MySQL + Kafka
   - 端口: 3002
   - 功能: 深度数据清洗，质量评估，数据验证

### 数据流架构

```
前端埋点 → 埋点接收服务 → Kafka → 初步数据处理服务 → Kafka → 最终数据清洗服务 → 数据存储
                ↓
            原始数据存储
                ↓
        数据仪表板API服务 ← 清洗后数据
                ↓
            前端仪表板
```

### Kafka 消息主题

1. **raw_event_received**: 原始事件接收
2. **batch_events_received**: 批量事件接收
3. **event_preliminary_processed**: 初步处理完成
4. **event_final_cleaned**: 最终清洗完成
5. **event_processing_status**: 处理状态更新
6. **cleaning_status_update**: 清洗状态更新
7. **data_quality_check**: 数据质量检查
8. **batch_cleaning_request**: 批量清洗请求

### 数据库设计

#### 主要数据表

1. **event_01**: 原始事件数据
2. **processed_events**: 处理过的事件数据
3. **cleaned_events**: 清洗后的事件数据

#### 数据字段

- **基础字段**: id, eventName, ip, ua, site, path, params, deviceId
- **UTM字段**: utmSource, utmMedium, utmCampaign, utmTerm, utmContent
- **时间字段**: logTime, serviceTime, processedAt, cleanedAt
- **状态字段**: processingStatus, cleaningStatus, isValid
- **元数据字段**: processingMetadata, cleaningMetadata, qualityScore

### API 接口

#### 埋点接收服务

- `GET /data/beacon`: 接收Beacon埋点数据
- `POST /data/track`: 接收单个埋点事件
- `POST /data/track/batch`: 接收批量埋点事件
- `GET /data/page`: 获取页面访问数据
- `GET /data/page-detail`: 获取页面详细数据

#### 数据仪表板API服务

- `GET /dashboard/overview`: 获取仪表板概览
- `GET /dashboard/realtime`: 获取实时数据
- `GET /dashboard/trends`: 获取访问趋势
- `GET /dashboard/user-behavior`: 获取用户行为分析
- `GET /dashboard/device-stats`: 获取设备统计
- `GET /dashboard/geo-distribution`: 获取地理位置分布

#### 分析服务

- `GET /analytics/funnel`: 漏斗分析
- `GET /analytics/retention`: 留存分析
- `GET /analytics/events`: 事件分析
- `GET /analytics/reports`: 自定义报告
- `POST /analytics/reports`: 创建自定义报告
- `GET /analytics/export`: 数据导出

### 部署配置

#### 环境变量

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=probe_x

# Kafka配置
KAFKA_BROKERS=localhost:9092

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 服务端口
PORT=8000  # 前端服务
PORT=3004  # 埋点接收服务
PORT=3001  # 数据仪表板API服务
PORT=3002  # 最终数据清洗服务
PORT=3003  # 初步数据处理服务
```

#### 启动命令

```bash
# 启动所有服务
yarn dev

# 启动单个服务
yarn start:frontend
yarn start:receiving-point-service
yarn start:data-dashboard-api-service
yarn start:preliminary-data-processing-service
yarn start:final-data-cleaning-service
```

### 技术特性

1. **微服务架构**: 服务间解耦，独立部署
2. **消息队列**: 使用Kafka实现异步处理
3. **数据管道**: 多阶段数据处理流程
4. **实时分析**: 支持实时数据统计和分析
5. **数据质量**: 多层次数据清洗和验证
6. **可扩展性**: 支持水平扩展和负载均衡

### 监控和运维

1. **日志管理**: 结构化日志记录
2. **错误处理**: 统一异常处理机制
3. **性能监控**: 处理时间和质量指标
4. **数据质量**: 质量评分和异常检测
5. **健康检查**: 服务健康状态监控

## 开发指南

### 添加新的埋点事件

1. 在前端添加埋点代码
2. 在接收服务中处理新事件类型
3. 在数据处理服务中添加处理逻辑
4. 在分析服务中添加分析维度

### 扩展分析功能

1. 在共享类型中定义新的分析接口
2. 在数据仪表板API服务中实现分析逻辑
3. 在前端添加可视化组件
4. 更新API文档

### 性能优化

1. 数据库索引优化
2. Kafka分区策略优化
3. 缓存策略实现
4. 批量处理优化

## 总结

Probe-X 系统采用现代化的微服务架构，通过Kafka消息队列实现服务间通信，支持大规模埋点数据的实时处理和分析。系统具有良好的可扩展性和可维护性，能够满足企业级数据分析需求。
