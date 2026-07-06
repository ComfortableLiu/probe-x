# Probe-X Docker 部署指南

本文档介绍如何使用 Docker Compose 一键部署 Probe-X 数据分析系统。

## 目录

- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [服务架构](#服务架构)
- [常用命令](#常用命令)
- [故障排除](#故障排除)
- [生产环境部署](#生产环境部署)

## 系统要求

### 硬件要求

| 资源 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 4 核 | 8 核 |
| 内存 | 8 GB | 16 GB |
| 磁盘 | 50 GB SSD | 100 GB SSD |

### 软件要求

- Docker Engine >= 20.10
- Docker Compose >= 2.0
- 操作系统：Linux / macOS / Windows (WSL2)

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/ComfortableLiu/probe-x.git
cd probe-x
```

### 2. 配置环境变量

```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑配置文件（必须修改安全配置）
vim .env
```

**重要：必须修改以下安全配置：**

```bash
# 生成随机密钥（示例）
SIGNATURE_SECRET=$(openssl rand -hex 32)
SALT=$(openssl rand -hex 16)
HMAC_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
```

### 3. 启动服务

```bash
# 构建并启动所有服务
docker compose up -d --build

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

### 4. 访问系统

- **前端界面**: http://localhost
- **API 服务**: http://localhost:8101/api
- **数据接收服务**: http://localhost:8104

### 5. 初始化管理员账号

首次部署后，需要通过 API 创建管理员账号：

```bash
curl -X POST http://localhost:8101/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "your_secure_password",
    "nickname": "系统管理员"
  }'
```

## 配置说明

### 环境变量配置

#### 数据库配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 | `probe_x_root_2024` |
| `DB_USERNAME` | 数据库用户名 | `probe_x` |
| `DB_PASSWORD` | 数据库密码 | `probe_x_2024` |
| `DB_DATABASE` | 数据库名称 | `probe_x` |

#### ClickHouse 配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `CLICKHOUSE_USER` | ClickHouse 用户名 | `default` |
| `CLICKHOUSE_PASSWORD` | ClickHouse 密码 | 空 |
| `CLICKHOUSE_DATABASE` | ClickHouse 数据库 | `probe_x` |

#### Redis 配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `REDIS_PASSWORD` | Redis 密码 | `probe_x_redis_2024` |

#### 端口配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `FRONTEND_PORT` | 前端访问端口 | `80` |
| `MYSQL_PORT` | MySQL 端口 | `3306` |
| `KAFKA_EXTERNAL_PORT` | Kafka 端口 | `9092` |
| `CLICKHOUSE_HTTP_PORT` | ClickHouse HTTP 端口 | `8123` |
| `REDIS_PORT` | Redis 端口 | `6379` |

## 服务架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Probe-X 系统架构                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐      ┌──────────────────────────────────┐ │
│  │   Frontend   │──────│   Nginx (端口 80)                │ │
│  │   (React)    │      │   - 静态文件服务                  │ │
│  └─────────────┘      │   - API 代理                      │ │
│                       └──────────────────────────────────┘ │
│                              │                              │
│                              ▼                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Data Dashboard API Service                  │  │
│  │           (NestJS, 端口 8101)                         │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│  ┌─────────────┐    ┌───────────────┐    ┌─────────────┐  │
│  │    MySQL     │    │   ClickHouse  │    │    Redis     │  │
│  │  (元数据)    │    │  (事件数据)   │    │   (缓存)     │  │
│  └─────────────┘    └───────────────┘    └─────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Kafka (消息队列)                          │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                    │                              │
│         ▼                    ▼                              │
│  ┌─────────────────┐  ┌─────────────────────────────────┐ │
│  │ Receiving Point  │  │ Preliminary Data Processing     │ │
│  │ Service (8104)   │  │ Service (8103)                  │ │
│  │ (数据接收)       │  │ (初步处理)                      │ │
│  └─────────────────┘  └─────────────────────────────────┘ │
│                              │                              │
│                              ▼                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        Final Data Cleaning Service (gRPC)             │  │
│  │        (最终数据清洗, 端口 10000)                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 数据流向

1. **数据采集**: Web SDK → Receiving Point Service → Kafka
2. **初步处理**: Kafka → Preliminary Data Processing Service → ClickHouse (event_log)
3. **最终清洗**: Final Data Cleaning Service → ClickHouse (final_event_log, event_attribution)
4. **数据展示**: Frontend → Data Dashboard API Service → ClickHouse

## 常用命令

### 服务管理

```bash
# 启动所有服务
docker compose up -d

# 停止所有服务
docker compose down

# 重启所有服务
docker compose restart

# 重启单个服务
docker compose restart data-dashboard-api-service

# 查看服务状态
docker compose ps

# 查看服务日志
docker compose logs -f
docker compose logs -f data-dashboard-api-service
```

### 构建管理

```bash
# 重新构建所有服务
docker compose build

# 重新构建并启动
docker compose up -d --build

# 重新构建单个服务
docker compose build data-dashboard-api-service
docker compose up -d data-dashboard-api-service
```

### 数据管理

```bash
# 备份 MySQL 数据
docker compose exec mysql mysqldump -u root -p probe_x > backup.sql

# 恢复 MySQL 数据
docker compose exec -T mysql mysql -u root -p probe_x < backup.sql

# 备份 ClickHouse 数据
docker compose exec clickhouse clickhouse-backup create

# 查看数据卷
docker volume ls | grep probe-x
```

### 调试命令

```bash
# 进入容器
docker compose exec data-dashboard-api-service sh

# 查看容器资源使用
docker stats

# 检查服务健康状态
docker compose ps --format "table {{.Name}}\t{{.Status}}"

# 测试服务连接
docker compose exec data-dashboard-api-service curl http://mysql:3306
docker compose exec data-dashboard-api-service curl http://kafka:9092
```

## 故障排除

### 常见问题

#### 1. 服务启动失败

**问题**: 服务状态显示 `unhealthy` 或不断重启

**解决方案**:
```bash
# 查看服务日志
docker compose logs service-name

# 检查依赖服务状态
docker compose ps

# 确认环境变量配置正确
docker compose exec service-name env
```

#### 2. MySQL 连接失败

**问题**: 服务无法连接到 MySQL

**解决方案**:
```bash
# 检查 MySQL 是否就绪
docker compose exec mysql mysqladmin ping -u root -p

# 检查 MySQL 日志
docker compose logs mysql

# 确认数据库用户权限
docker compose exec mysql mysql -u root -p -e "SELECT user, host FROM mysql.user;"
```

#### 3. ClickHouse 连接失败

**问题**: 服务无法连接到 ClickHouse

**解决方案**:
```bash
# 检查 ClickHouse 是否就绪
docker compose exec clickhouse wget -qO- http://localhost:8123/ping

# 检查 ClickHouse 日志
docker compose logs clickhouse

# 测试查询
docker compose exec clickhouse clickhouse-client -q "SELECT 1"
```

#### 4. Kafka 连接失败

**问题**: 服务无法连接到 Kafka

**解决方案**:
```bash
# 检查 Kafka 是否就绪
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --list

# 检查 Kafka 日志
docker compose logs kafka

# 列出所有 topic
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --list
```

#### 5. 磁盘空间不足

**问题**: Docker 数据占用过多磁盘空间

**解决方案**:
```bash
# 清理未使用的 Docker 资源
docker system prune -a

# 清理数据卷（注意：会删除数据！）
docker compose down -v

# 查看磁盘使用情况
docker system df
```

### 日志位置

- **容器日志**: `docker compose logs service-name`
- **MySQL 数据**: `/var/lib/mysql` (容器内)
- **ClickHouse 数据**: `/var/lib/clickhouse` (容器内)
- **Kafka 数据**: `/bitnami/kafka` (容器内)

## 生产环境部署

### 安全加固

1. **修改默认密码**: 必须修改所有默认密码
2. **启用 HTTPS**: 配置 SSL 证书
3. **限制网络访问**: 只暴露必要端口
4. **定期备份**: 配置自动备份策略

### 性能优化

1. **MySQL 优化**:
   ```bash
   # 在 .env 中添加
   MYSQL_INNODB_BUFFER_POOL_SIZE=4G
   MYSQL_MAX_CONNECTIONS=500
   ```

2. **ClickHouse 优化**:
   ```bash
   # 增加内存限制
   CLICKHOUSE_MAX_MEMORY_USAGE=8G
   ```

3. **Kafka 优化**:
   ```bash
   # 增加分区数
   KAFKA_CFG_NUM_PARTITIONS=6
   ```

### 监控配置

建议使用以下监控方案：

- **Prometheus + Grafana**: 系统指标监控
- **ELK Stack**: 日志收集和分析
- **ClickHouse Monitoring**: ClickHouse 自带监控

### 备份策略

```bash
#!/bin/bash
# backup.sh - 自动备份脚本

BACKUP_DIR="/backup/probe-x"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份 MySQL
docker compose exec mysql mysqldump -u root -p$MYSQL_ROOT_PASSWORD probe_x | gzip > $BACKUP_DIR/mysql_$DATE.sql.gz

# 备份 ClickHouse
docker compose exec clickhouse clickhouse-backup create

# 清理 7 天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

### Docker Swarm 部署

如需高可用部署，可使用 Docker Swarm：

```bash
# 初始化 Swarm
docker swarm init

# 部署服务栈
docker stack deploy -c docker-compose.yml probe-x

# 查看服务状态
docker service ls
```

## 升级指南

### 版本升级

```bash
# 拉取最新代码
git pull origin master

# 停止服务
docker compose down

# 重新构建并启动
docker compose up -d --build

# 执行数据库迁移（如有）
docker compose exec data-dashboard-api-service npm run db:migrate
```

### 数据迁移

升级前请务必备份数据：

```bash
# 备份数据
./scripts/backup.sh

# 升级服务
docker compose down
docker compose up -d --build

# 验证服务状态
docker compose ps
```

## 相关链接

- [Probe-X GitHub](https://github.com/ComfortableLiu/probe-x)
- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)

## 技术支持

如有问题，请通过以下方式联系：

- GitHub Issues: https://github.com/ComfortableLiu/probe-x/issues
- 邮箱: liuchengxu1994@gmail.com
