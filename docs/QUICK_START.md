# 🚀 Probe-X 快速启动指南

## 📋 快速命令参考

### 🎯 最常用命令

```bash
# 启动所有服务 (推荐)
yarn dev

# 或者使用脚本
./scripts/start.sh all          # Linux/Mac
scripts\start.bat all           # Windows
```

### 🔧 单个服务启动

```bash
# 前端服务
yarn start:frontend

# 埋点接收服务
yarn start:receiving-point

# 数据仪表板API服务
yarn start:dashboard-api

# 初步数据处理服务
yarn start:preliminary-processing

# 最终数据清洗服务
yarn start:final-cleaning
```

### 📦 打包命令

```bash
# 打包所有服务
yarn build

# 按顺序打包 (推荐)
yarn build:sequence
```

### 🛠️ 开发工具

```bash
# 运行测试
yarn test

# 代码检查
yarn lint

# 清理构建文件
yarn clean
```

## 🌐 服务端口

| 服务 | 端口 | 描述 |
|------|------|------|
| 前端 | 8000 | React 应用 |
| 埋点接收服务 | 3004 | 接收埋点数据 |
| 数据仪表板API | 3001 | 数据API服务 |
| 最终数据清洗 | 3002 | 数据清洗服务 |
| 初步数据处理 | 3003 | 数据处理服务 |

## 🚀 首次启动

### 1. 安装依赖
```bash
yarn install
```

### 2. 启动所有服务
```bash
yarn dev
```

### 3. 访问应用
- 前端: http://localhost:8000
- API文档: http://localhost:3001

## 🔧 开发模式

### 只启动前端
```bash
yarn dev:frontend
```

### 只启动后端服务
```bash
yarn dev:backend
```

### 启动特定服务
```bash
yarn start:receiving-point
yarn start:dashboard-api
yarn start:preliminary-processing
yarn start:final-cleaning
```

## 📊 监控和调试

### 查看服务状态
```bash
yarn status
```

### 查看日志
```bash
yarn logs:frontend
yarn logs:receiving-point
yarn logs:dashboard-api
yarn logs:preliminary-processing
yarn logs:final-cleaning
```

### 重启服务
```bash
yarn restart:all
```

### 停止服务
```bash
yarn stop:all
```

## 🏗️ 生产部署

### 1. 构建项目
```bash
yarn build:sequence
```

### 2. 部署准备
```bash
yarn deploy:all
```

## 🆘 常见问题

### 端口被占用
```bash
# 停止所有服务
yarn stop:all

# 检查端口占用
lsof -i :3000
lsof -i :3001
lsof -i :3002
lsof -i :3003
```

### 构建失败
```bash
# 清理缓存
yarn clean

# 重新安装依赖
yarn install

# 重新构建
yarn build:sequence
```

### 服务启动失败
```bash
# 查看服务状态
yarn status

# 查看日志
yarn logs:service-name

# 重启服务
yarn restart:all
```

## 📚 更多信息

- 详细命令指南: [COMMANDS_GUIDE.md](./COMMANDS_GUIDE.md)
- 系统架构: [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)
- 项目文档: [README.md](./README.md)

## 🎯 快速脚本使用

### Linux/Mac
```bash
# 启动所有服务
./scripts/start.sh all

# 只启动前端
./scripts/start.sh frontend

# 只启动后端
./scripts/start.sh backend

# 开发模式
./scripts/start.sh dev

# 构建项目
./scripts/start.sh build

# 查看帮助
./scripts/start.sh help
```

### Windows
```cmd
REM 启动所有服务
scripts\start.bat all

REM 只启动前端
scripts\start.bat frontend

REM 只启动后端
scripts\start.bat backend

REM 开发模式
scripts\start.bat dev

REM 构建项目
scripts\start.bat build

REM 查看帮助
scripts\start.bat help
```

## ⚡ 一键启动

```bash
# 最简单的方式 - 启动所有服务
yarn dev
```

就这么简单！🎉
