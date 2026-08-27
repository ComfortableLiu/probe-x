# 🚀 Probe-X

> 一款现代化的Web数据分析解决方案，基于微服务架构的埋点与数据分析系统

[![CI](https://github.com/ComfortableLiu/probe-x/actions/workflows/ci.yml/badge.svg)](https://github.com/ComfortableLiu/probe-x/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.12.0-brightgreen.svg)](https://nodejs.org/)
[![Yarn Version](https://img.shields.io/badge/yarn-%3E%3D1.22.0-blue.svg)](https://yarnpkg.com/)

## ✨ 功能特性

### 🎯 埋点数据收集
- **全埋点**: 页面PV、PL事件、点击事件自动收集
- **自定义埋点**: 业务自定义事件埋点
- **实时上报**: 支持实时和批量数据上报
- **多端支持**: Web 端埋点支持，未来会支持到移动端

### 🔧 数据处理管道
- **初步处理**: 数据 Session 切割、UTM 相关参数补充
- **深度清洗**: 补充元数据的归因数据
- **实时处理**: 适用于实时性要求高并需要归因数据的场景，如推荐服务（暂时没有）

### 📊 数据分析与可视化
- **事件分析**: 基于事件的指标统计、筛选、分组等功能，来追踪用户行为或业务过程
- **漏斗分析**: 用于分析一个多步骤过程中每一步的转化与流失情况
- **用户路径分析**: 主要用于分析用户在使用产品时的路径分布情况
- **归因分析**: 通过结果反向分析各个触点对于结果的贡献程度
- **留存分析**: 分析用户在特定时间窗口内的回访情况，支持按日/周/月计算留存率
- **用户分群**: 基于用户行为和属性条件进行用户分群，支持组合条件和动态计算

## 🏗️ 系统架构

### 微服务组件
- **前端服务**: React + TypeScript 数据可视化界面
- **Web SDK**: 原生 JavaScript 埋点数据收集SDK，框架无关
- **电商 Demo**: 简化的电商网站演示项目
- **数据仪表板API服务**: 提供前端管理页面的 API 接口，包括数分、埋点管理、SSO 登录等
- **埋点接收服务**: 接收和存储原始埋点数据，然后通过 kafka 转发给数据处理服务
- **初步数据处理服务**: 数据初步补充数据，包括 session 切割、utm 参数补充、SPM/SCM 翻译等
- **最终数据清洗服务**: 数据最终清洗，主要清洗归因数据

### 技术栈
- **前端**: React19, Redux, Rematch, Ant Design, TypeScript, Rspack
- **Web SDK**: 原生JavaScript, TypeScript, Rollup (支持UMD/ESM/CJS多种模块格式)
- **后端**: NestJS, TypeORM, gRPC, Redis
- **数据储存**: MySQL
- **大数据**: ClickHouse
- **缓存**: Redis（用于实时清洗服务，暂时没用上）
- **消息队列**: Kafka
- **服务通信**: gRPC
- **构建工具**: Nx, Rspack

## 🚀 快速开始

### 方式一：Docker Compose 一键部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/ComfortableLiu/probe-x.git
cd probe-x

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，修改安全配置（必须！）

# 3. 启动所有服务
docker compose up -d --build

# 4. 查看服务状态
docker compose ps

# 5. 访问系统
# 前端界面: http://localhost
# API 服务: http://localhost:8101/api
```

> 📚 详细部署文档请参考 [Docker 部署指南](./docs/docker-deployment.md)

### 方式二：本地开发环境

#### 环境要求
- Node.js >= 18.12.0（暂定，Rspack限制）
- Yarn >= 1.22.0
- MySQL >= 5.7
- Kafka >= 2.8.0
- Redis >= 6.0
- ClickHouse >= 24.8

#### 安装和启动

```bash
# 1. 克隆项目
git clone https://github.com/ComfortableLiu/probe-x.git
cd probe-x

# 2. 安装依赖
yarn

# 3. 启动所有服务
yarn dev
```

#### 管理员账号初始化

`scripts/init-db.sql` 只会插入占位密码的 `admin` 用户，**无法直接登录**。首次部署（或 admin 密码被重置）后，需要运行初始化脚本设置密码：

```bash
# 使用默认初始密码 admin123（登录后请立即修改）
yarn init:admin

# 或指定自定义初始密码
yarn init:admin --password=<你的密码>
# 也可以用环境变量：ADMIN_PASSWORD=<你的密码> yarn init:admin
```

- 脚本位置：`scripts/init-admin-password.js`
- 初始账号：`admin`，初始密码：`admin123`（默认，建议用 `--password` 覆盖）
- 脚本会自动加载 `apps/data-dashboard-api-service/config/env/` 下的 `.env*` 配置，依赖其中的数据库配置（`DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE`）以及 `SALT`、`HMAC_SECRET`——**后两者必须与 API 服务的运行配置一致**，否则密码校验不通过
- 登录接口提示「admin密码未初始化，请管理员先通过初始化脚本设置密码后再登录」时，运行本脚本即可

## 📋 常用命令

### 🎯 启动服务
```bash
# 启动所有服务
yarn dev

# 启动单个服务
yarn start:frontend              # 前端服务 (端口: 8000)
yarn start:receiving-point       # 埋点接收服务 (端口: 3004)
yarn start:dashboard-api         # 数据仪表板API服务 (端口: 3001)
yarn start:preliminary-processing # 初步数据处理服务 (端口: 3003)
yarn start:final-cleaning        # 最终数据清洗服务 (端口: 3002)
yarn start:ecommerce-demo        # 电商Demo服务 (端口: 9000)
```

### 📦 构建和部署
```bash
# 构建所有服务
yarn build

# 按顺序构建 (推荐)
yarn build:sequence

# 部署准备
yarn deploy:all
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

### 📊 监控和调试
```bash
# 查看服务状态
yarn status

# 查看日志
yarn logs:frontend
yarn logs:receiving-point
yarn logs:dashboard-api
yarn logs:preliminary-processing
yarn logs:final-cleaning

# 重启服务
yarn restart:all
```

## 📱 Web SDK 使用

### 安装
```html
<!-- CDN方式 -->
<script src="https://cdn.jsdelivr.net/npm/@probe-x/web-sdk@latest/dist/probe-x-sdk.min.js"></script>

<!-- 本地文件 -->
<script src="./probe-x-sdk.min.js"></script>
```

### NPM安装
```bash
npm install @probe-x/web-sdk
# 或
yarn add @probe-x/web-sdk
```

### 基础使用
```javascript
// 浏览器环境中直接使用
const probeX = new ProbeX({
  apiUrl: 'http://localhost:3004/point/report',  // 埋点接收服务地址
  appId: 'your-app-id',
  debug: true
});

// 或通过ES模块导入
import ProbeX from '@probe-x/web-sdk';

// 手动埋点
probeX.track('button_click', {
  button_name: '登录按钮',
  page: 'login'
});

// 设置用户属性
probeX.setUser({
  user_id: '12345',
  user_name: '张三'
});
```

### 自动埋点
SDK会自动收集以下事件：
- 页面访问 (page_view)
- 点击事件 (click)
- 滚动事件 (scroll)
- 表单事件 (form_submit, form_field_change)
- 错误事件 (javascript_error)
- 性能事件 (page_performance)
- 心跳事件 (heartbeat)

## 🛠️ Web SDK 构建说明

Web SDK使用Rollup进行构建，支持多种模块格式：
- **UMD**: 适用于浏览器直接引入
- **ESM**: 适用于现代打包工具
- **CJS**: 适用于Node.js环境

构建输出包括：
- `probe-x-sdk.js` - UMD格式（开发版）
- `probe-x-sdk.min.js` - UMD格式（压缩版）
- `probe-x-sdk.esm.js` - ES模块格式
- `probe-x-sdk.cjs.js` - CommonJS格式
- `probe-x-sdk.d.ts` - TypeScript类型定义

## 🎯 快速脚本

### Linux/Mac
```bash
# 启动所有服务
./scripts/start.sh all

# 只启动前端
./scripts/start.sh frontend

# 开发模式
./scripts/start.sh dev
```

### Windows
```cmd
REM 启动所有服务
scripts\start.bat all

REM 只启动前端
scripts\start.bat frontend

REM 开发模式
scripts\start.bat dev
```

## 🛒 电商Demo

我们提供了一个完整的React+TypeScript电商Demo项目来演示Probe-X数据埋点平台的功能：

### 快速体验
```bash
# 启动电商Demo
yarn start:ecommerce-demo

# 在浏览器中访问
open http://localhost:9000
```

### Demo功能
- **商品浏览**: 浏览商品列表，查看商品详情
- **购物车**: 添加商品到购物车，管理购物车商品
- **搜索筛选**: 按关键词搜索商品，按分类筛选
- **订单管理**: 完整的下单流程和订单管理
- **用户中心**: 查看用户信息和统计数据
- **数据埋点**: 自动追踪用户行为和页面访问

### 技术特点
- **React 18 + TypeScript**: 现代化的前端技术栈
- **Ant Design 5**: 企业级UI组件库
- **响应式设计**: 支持移动端和桌面端
- **完整埋点**: 集成Probe-X SDK进行数据追踪
- **模拟数据**: 内置丰富的模拟商品数据
- **完整业务流程**: 从商品浏览到订单完成的完整电商流程

## 📚 文档

### 主要文档
- [Docker 部署指南](./docs/docker-deployment.md) - Docker 一键部署
- [快速启动指南](./docs/QUICK_START.md) - 快速上手指南
- [命令使用指南](./docs/COMMANDS_GUIDE.md) - 详细命令说明
- [系统架构文档](./docs/SYSTEM_ARCHITECTURE.md) - 系统架构详解
- [Web SDK使用指南](./docs/WEB_SDK_GUIDE.md) - Web SDK详细使用说明
- [准确系统架构文档](./docs/ACCURATE_SYSTEM_ARCHITECTURE.md) - 基于实际代码的详细架构说明
- [数据分析 API 文档](./docs/api/data-analysis-api.md) - 留存分析和用户分群 API

### 开发指南
- [快速启动指南](./docs/QUICK_START.md) - 环境搭建和快速开始
- [命令使用指南](./docs/COMMANDS_GUIDE.md) - 项目命令详解
- [系统架构文档](./docs/SYSTEM_ARCHITECTURE.md) - 系统架构和组件说明
- [Web SDK使用指南](./docs/WEB_SDK_GUIDE.md) - SDK集成和使用方法

## 🔧 配置

### 环境变量
各服务需要配置相应的环境变量，参考各服务的 `.env.example` 文件：

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
```

## 🌐 服务端口

| 服务 | 端口 | 描述 |
|------|------|------|
| 前端 | 8000 | React 应用界面 |
| 埋点接收服务 | 3004 | 接收埋点数据 |
| 数据仪表板API | 3001 | 数据分析和API服务 |
| 最终数据清洗 | 3002 | 数据清洗服务 |
| 初步数据处理 | 3003 | 数据处理服务 |
| 电商Demo | 9000 | React+TypeScript电商演示网站 |

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

### CI 持续集成

仓库已配置 GitHub Actions CI（`.github/workflows/ci.yml`），在 push 到 `master`/`main` 及所有 Pull Request 时自动执行：

1. 安装依赖（`yarn install --frozen-lockfile`）
2. 全量代码检查（`yarn lint`）
3. Web SDK 单元测试（`yarn nx test web-sdk`）
4. 全量构建（`shared-types`、`shared-utils`、4 个后端服务、`frontend`、`ecommerce-demo`、`web-sdk`）

提交 PR 前请确保以上检查在本地通过。

## 📄 许可证

本项目基于 MIT 许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👨‍💻 作者

**逍遥成居士** - [liuchengxu1994@gmail.com](mailto:liuchengxu1994@gmail.com)

## 🙏 致谢

- 基于阿里SCM/SPM模型进行二创
- 感谢所有贡献者的支持

---

⭐ 如果这个项目对你有帮助，请给它一个星标！