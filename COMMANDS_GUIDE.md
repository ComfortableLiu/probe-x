# Probe-X 项目命令使用指南

## 📋 命令概览

本项目提供了完整的命令体系，支持单个服务启动、批量操作、开发调试、生产部署等各种场景。

## 🚀 单个服务启动命令

### 前端服务
```bash
# 启动前端服务 (端口: 3000)
yarn start:frontend
```

### Web SDK
```bash
# 启动Web SDK开发模式 (监听文件变化)
yarn start:web-sdk
```

### 后端服务
```bash
# 启动埋点接收服务 (端口: 3000)
yarn start:receiving-point

# 启动数据仪表板API服务 (端口: 3001)
yarn start:dashboard-api

# 启动初步数据处理服务 (端口: 3002)
yarn start:preliminary-processing

# 启动最终数据清洗服务 (端口: 3003)
yarn start:final-cleaning
```

## 📦 单个服务打包命令

### 前端打包
```bash
# 打包前端服务
yarn build:frontend
```

### Web SDK打包
```bash
# 打包Web SDK (生成UMD、ESM、CJS格式)
yarn build:web-sdk
```

### 后端服务打包
```bash
# 打包埋点接收服务
yarn build:receiving-point

# 打包数据仪表板API服务
yarn build:dashboard-api

# 打包初步数据处理服务
yarn build:preliminary-processing

# 打包最终数据清洗服务
yarn build:final-cleaning
```

## 🔧 开发环境命令

### 启动所有服务
```bash
# 启动所有服务 (前端 + 所有后端服务)
yarn dev
```

### 分组启动
```bash
# 只启动前端服务
yarn dev:frontend

# 只启动所有后端服务
yarn dev:backend
# 或者
yarn dev:services
```

## 🏗️ 生产环境打包命令

### 完整打包
```bash
# 打包所有服务 (并行执行)
yarn build

# 打包所有服务 (顺序执行，确保依赖关系)
yarn build:sequence
```

### 分组打包
```bash
# 只打包前端
yarn build:frontend-only

# 只打包后端服务
yarn build:backend-only
```

### 共享库打包
```bash
# 打包共享类型库
yarn build:shared-types
# 或者
yarn build:lib
```

## 🧪 测试命令

### 运行所有测试
```bash
# 运行所有服务的测试
yarn test
```

### 单个服务测试
```bash
# 测试前端
yarn test:frontend

# 测试埋点接收服务
yarn test:receiving-point

# 测试数据仪表板API服务
yarn test:dashboard-api

# 测试初步数据处理服务
yarn test:preliminary-processing

# 测试最终数据清洗服务
yarn test:final-cleaning
```

## 🔍 代码检查命令

```bash
# 检查所有服务的代码
yarn lint

# 检查并自动修复代码问题
yarn lint:fix
```

## 🚀 部署命令

```bash
# 打包所有服务并准备部署
yarn deploy:all

# 只打包前端用于部署
yarn deploy:frontend

# 只打包后端服务用于部署
yarn deploy:backend
```

## 🛠️ 服务管理命令

```bash
# 停止所有运行中的服务
yarn stop:all

# 重启所有服务
yarn restart:all

# 查看服务运行状态
yarn status
```

## 🗄️ 数据库相关命令

```bash
# 数据库迁移 (需要在各服务中单独执行)
yarn db:migrate

# 数据种子 (需要在各服务中单独执行)
yarn db:seed
```

## 📊 监控和日志命令

### 查看日志
```bash
# 查看前端日志
yarn logs:frontend

# 查看埋点接收服务日志
yarn logs:receiving-point

# 查看数据仪表板API服务日志
yarn logs:dashboard-api

# 查看初步数据处理服务日志
yarn logs:preliminary-processing

# 查看最终数据清洗服务日志
yarn logs:final-cleaning
```

## 🧹 清理命令

```bash
# 清理构建缓存和dist目录
yarn clean

# 完全清理 (包括node_modules)
yarn clean:all
```

## 📝 常用开发流程

### 1. 首次启动项目
```bash
# 安装依赖
yarn install

# 启动所有服务
yarn dev
```

### 2. 开发单个服务
```bash
# 只启动前端进行开发
yarn dev:frontend

# 或者只启动特定后端服务
yarn start:receiving-point
```

### 3. 测试代码
```bash
# 运行所有测试
yarn test

# 检查代码质量
yarn lint
```

### 4. 生产部署
```bash
# 打包所有服务
yarn build

# 或者按顺序打包确保依赖
yarn build:sequence
```

### 5. 问题排查
```bash
# 查看服务状态
yarn status

# 查看特定服务日志
yarn logs:service-name

# 重启所有服务
yarn restart:all
```

## 🔧 环境配置

### 开发环境
- 前端: http://localhost:3000
- 埋点接收服务: http://localhost:3000
- 数据仪表板API: http://localhost:3001
- 初步数据处理服务: http://localhost:3002
- 最终数据清洗服务: http://localhost:3003

### 生产环境
- 所有服务打包到 `dist/` 目录
- 需要配置相应的环境变量
- 建议使用 PM2 或 Docker 进行部署

## ⚠️ 注意事项

1. **依赖关系**: 共享库需要先构建，建议使用 `yarn build:sequence`
2. **端口冲突**: 确保各服务端口不冲突
3. **环境变量**: 各服务需要正确配置环境变量
4. **数据库**: 确保数据库服务正常运行
5. **Kafka**: 确保Kafka服务正常运行

## 🆘 故障排除

### 服务启动失败
```bash
# 检查服务状态
yarn status

# 查看日志
yarn logs:service-name

# 重启服务
yarn restart:all
```

### 构建失败
```bash
# 清理缓存
yarn clean

# 重新安装依赖
yarn install

# 重新构建
yarn build
```

### 端口占用
```bash
# 停止所有服务
yarn stop:all

# 检查端口占用
lsof -i :3000
lsof -i :3001
lsof -i :3002
lsof -i :3003
```

## 📚 更多信息

- 项目架构: 查看 `SYSTEM_ARCHITECTURE.md`
- 服务配置: 查看各服务的 `package.json` 和配置文件
- 环境变量: 查看各服务的 `.env.example` 文件
