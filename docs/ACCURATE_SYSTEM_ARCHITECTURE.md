# Probe-X 系统准确架构文档

## 1. 系统概述

Probe-X 是一个现代化的Web数据分析解决方案，基于微服务架构的埋点与数据分析系统。系统采用事件驱动架构，通过Kafka消息队列实现异步数据处理，支持大规模埋点数据的实时收集、处理、清洗和分析。

### 1.1 系统目标
- 实时收集Web端用户行为数据
- 高效处理和清洗大规模埋点数据
- 提供灵活的数据分析和可视化功能
- 支持多维度用户行为分析

### 1.2 核心组件
- **前端服务**: React + TypeScript 数据可视化界面
- **Web SDK**: 原生JavaScript埋点数据收集SDK
- **埋点接收服务**: 接收和存储原始埋点数据
- **数据仪表板API服务**: 提供数据分析API接口
- **初步数据处理服务**: 数据初步处理和增强
- **最终数据清洗服务**: 深度数据清洗和验证

## 2. 微服务架构

### 2.1 服务组件详情

#### 2.1.1 前端服务 (frontend)
- **技术栈**: React 19, TypeScript, Rspack, Ant Design
- **端口**: 8000
- **功能**:
  - 数据可视化仪表板
  - 埋点管理界面
  - 用户行为分析展示
  - 实时数据监控
- **主要依赖**: Redux, Rematch, React Router v7

#### 2.1.2 Web SDK
- **技术栈**: 原生JavaScript, TypeScript, Rollup
- **构建输出**:
  - UMD格式 (浏览器直接引入)
  - ES模块格式 (现代打包工具)
  - CommonJS格式 (Node.js环境)
- **功能**:
  - 自动埋点 (页面访问、点击、滚动等)
  - 手动埋点API
  - 数据压缩和批量上报
  - 会话管理和设备识别
- **配置管理**: 支持多种配置选项，包括采样、过滤、存储等

#### 2.1.3 埋点接收服务 (receiving-point-service)
- **技术栈**: NestJS, TypeORM, MySQL, Kafka
- **端口**: 3004
- **功能**:
  - 接收原始埋点数据
  - 数据验证和初步处理
  - 存储到数据库
  - 发送到Kafka消息队列
- **API端点**:
  - `POST /point/report`: 接收埋点数据上报
- **数据流**: 前端SDK → 接收服务 → 数据库存储 → Kafka消息

#### 2.1.4 数据仪表板API服务 (data-dashboard-api-service)
- **技术栈**: NestJS, TypeORM, MySQL, Kafka, ClickHouse
- **端口**: 3001
- **功能**:
  - 提供数据分析API
  - 实时数据统计
  - 分析报告生成
  - 用户行为分析
- **分析功能**:
  - 事件分析
  - 漏斗分析
  - 用户路径分析
  - 归因分析
- **API模块**:
  - `/api/event/*`: 事件管理接口
  - `/api/property/*`: 属性管理接口
  - `/api/tracking-node/*`: 跟踪节点管理接口
  - `/api/data-analysis/*`: 数据分析接口

#### 2.1.5 初步数据处理服务 (preliminary-data-processing-service)
- **技术栈**: NestJS, TypeORM, MySQL, Kafka
- **端口**: 3003
- **功能**:
  - 数据Session切割
  - UTM参数补充
  - SPM/SCM翻译
  - 基础数据增强
  - 异常检测
- **Kafka消费者**: 监听原始事件并处理

#### 2.1.6 最终数据清洗服务 (final-data-cleaning-service)
- **技术栈**: NestJS, TypeORM, MySQL, Kafka
- **端口**: 3002
- **功能**:
  - 深度数据清洗
  - 归因数据补充
  - 数据质量评估
  - 异常数据处理
- **Kafka消费者**: 监听处理后事件并进行深度清洗

#### 2.1.7 电商Demo (ecommerce-demo)
- **技术栈**: React, TypeScript, Rspack, Ant Design
- **端口**: 9000
- **功能**:
  - 完整电商演示
  - 集成Probe-X SDK
  - 模拟真实业务场景

## 3. 数据架构

### 3.1 数据流架构

```
前端SDK → 埋点接收服务 → 原始数据存储 → Kafka → 初步数据处理服务 → Kafka → 最终数据清洗服务 → 清洗数据存储
     ↓                                                                                             ↓
   前端仪表板 ← 数据仪表板API服务 ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

### 3.2 Kafka 消息主题

- **`meta_event.to.preliminary_data_processing`**: 发送给初步数据处理服务的埋点元数据

### 3.3 数据模型 (基于共享类型定义)

#### 3.3.1 元事件模型 (IMetaEvent)
```typescript
interface IMetaEvent {
  eventName: string
  eventAliases: string
  eventRemark: string
  createTime: Date
  createUserId: number
  updateTime: Date
  updateUserId: number
  status: MetaEventStatus
  eventPropertyRelations?: IEventPropertyRelation[]
}
```

#### 3.3.2 元属性模型 (IMetaProperty)
```typescript
interface IMetaProperty {
  propertyName?: string
  propertyType?: MetaPropertyType
  type?: MetaPropertyBusinessType
  createTime?: Date
  createUserId?: number
  updateTime?: Date
  updateUserId?: number
  status?: MetaPropertyStatus
  eventPropertyRelations?: IEventPropertyRelation[]
}
```

#### 3.3.3 事件属性关联模型 (IEventPropertyRelation)
```typescript
interface IEventPropertyRelation {
  id?: number
  eventPropertyRemark?: string
  createTime?: Date
  createUserId?: number
  updateTime?: Date
  updateUserId?: number
  status?: EventPropertyRelationStatus
  metaEvent?: IMetaEvent
  metaProperty?: IMetaProperty
  eventName?: string
  propertyName?: string
}
```

#### 3.3.4 枚举定义
- **MetaEventStatus**: VALID(1), STOP(2), DISABLE(3), DELETE(4)
- **MetaPropertyType**: STRING, NUMBER, FLOAT, BOOLEAN, DATE
- **MetaPropertyBusinessType**: COMMON(1), BUSINESS(2)
- **MetaPropertyStatus**: VALID(1)
- **EventPropertyRelationStatus**: VALID(1)

### 3.4 事件详情数据结构 (EventDetailDto)
```typescript
interface EventDetailDto {
  eventName: string;
  eventAliases: string;
  eventRemark: string;
  createTime: Date;
  createUserId: number;
  updateUserId: number;
  updateTime: Date;
  status: number;
  properties: Array<{
    propertyName: string;
    propertyType: string;
    eventPropertyRemark: string;
    creatTime: Date;
  }>;
}
```

## 4. 通信架构

### 4.1 服务间通信
- **HTTP/REST**: 前端与后端服务间通信
- **Kafka**: 微服务间异步通信
- **gRPC**: 高性能服务间通信（未来扩展）

### 4.2 API设计规范
- RESTful API设计
- 统一的错误处理机制
- 统一的响应格式
- 认证和授权机制

## 5. 技术栈详解

### 5.1 前端技术栈
- **框架**: React 19 with TypeScript
- **状态管理**: Redux + Rematch
- **UI组件**: Ant Design 5
- **路由**: React Router v7
- **构建工具**: Rspack
- **样式**: CSS Modules + SCSS

### 5.2 后端技术栈
- **框架**: NestJS
- **数据库**: MySQL + TypeORM
- **大数据**: ClickHouse
- **缓存**: Redis
- **消息队列**: Kafka
- **构建工具**: Nx + Rspack

### 5.3 SDK技术栈
- **构建工具**: Rollup
- **语言**: TypeScript
- **模块格式**: UMD/ESM/CJS
- **打包**: 支持多种格式输出

## 6. 部署架构

### 6.1 环境配置

#### 6.1.1 环境变量
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

# 服务端口配置
CLIENT_PORT=8000  # 前端端口
DATA_DASHBOARD_API_SERVICE_PORT=8101  # 仪表板API端口
FINAL_DATA_CLEANING_SERVICE_PORT=8102  # 清洗服务端口
PRELIMINARY_DATA_PROCESSING_SERVICE_PORT=8103  # 处理服务端口
RECEIVING_POINT_SERVICE_PORT=8104  # 接收服务端口
```

### 6.2 服务端口映射

| 服务 | 开发端口 | 配置端口 | 描述 |
|------|----------|----------|------|
| 前端 | 8000 | 8000 | React应用界面 |
| 埋点接收 | 3004 | 8104 | 接收埋点数据 |
| 数据仪表板API | 3001 | 8101 | 数据分析API |
| 最终数据清洗 | 3002 | 8102 | 数据清洗服务 |
| 初步数据处理 | 3003 | 8103 | 数据处理服务 |
| 电商Demo | 9000 | 9000 | 电商演示应用 |

### 6.3 启动命令
```bash
# 启动所有服务
yarn dev

# 启动单个服务
yarn start:frontend
yarn start:receiving-point
yarn start:dashboard-api
yarn start:preliminary-processing
yarn start:final-cleaning
yarn start:ecommerce-demo
```

## 7. 分析功能

### 7.1 事件分析
- 事件统计
- 事件趋势
- 热门事件

### 7.2 漏斗分析
- 多步骤转化率分析
- 用户流失分析

### 7.3 用户路径分析
- 用户行为路径追踪
- 页面访问路径分析

### 7.4 归因分析
- 营销活动归因
- 用户触点贡献分析

## 8. 监控和运维

### 8.1 任务队列
- **Bull队列**: 用于数据查询下载任务
- **队列名称**: `query-download-queue`
- **任务名称**: `query-download-task`

### 8.2 数据下载任务
- **Redis存储**: 下载任务状态和结果
- **任务结构**: 包含任务ID、状态、SQL查询、创建时间等

## 9. 总结

Probe-X系统采用现代化的微服务架构，通过Kafka消息队列实现服务间通信，支持大规模埋点数据的实时处理和分析。系统具有良好的可扩展性和可维护性，能够满足企业级数据分析需求。通过清晰的分层架构和标准化接口，系统支持灵活的功能扩展和性能优化。