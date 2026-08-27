# 贡献指南

感谢你对 Probe-X 项目的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 报告 Bug

如果你发现了 Bug，请通过 [GitHub Issues](https://github.com/ComfortableLiu/probe-x/issues) 报告，并使用 Bug 报告模板。

### 提出功能建议

如果你有功能建议，请通过 [GitHub Issues](https://github.com/ComfortableLiu/probe-x/issues) 提出，并使用功能建议模板。

### 提交代码

1. **Fork 项目**
   ```bash
   # Fork 项目到你的 GitHub 账号
   ```

2. **克隆项目**
   ```bash
   git clone https://github.com/你的用户名/probe-x.git
   cd probe-x
   ```

3. **创建分支**
   ```bash
   git checkout -b feature/你的功能名称
   ```

4. **安装依赖**
   ```bash
   yarn
   ```

5. **进行开发**
   - 遵循代码规范
   - 添加必要的测试
   - 更新相关文档

6. **提交代码**
   ```bash
   git add .
   git commit -m "feat: 添加xxx功能"
   ```

7. **推送分支**
   ```bash
   git push origin feature/你的功能名称
   ```

8. **创建 Pull Request**
   - 填写 PR 描述
   - 关联相关 Issue
   - 等待代码审查

## 代码规范

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**:
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例**:
```
feat(data-analysis): 添加留存分析功能

- 支持按日/周/月计算留存率
- 支持自定义留存窗口
- 支持按用户属性分组

Closes #123
```

### 代码风格

- 使用 ESLint 进行代码检查
- 使用 Prettier 进行代码格式化
- 遵循 TypeScript 严格模式

```bash
# 检查代码风格
yarn lint

# 自动修复
yarn lint:fix
```

### 测试

- 为新功能添加单元测试
- 确保所有测试通过
- 测试覆盖率不低于 80%

```bash
# 运行测试
yarn test

# 运行 E2E 测试
cd test && bash run-e2e.sh
```

## 开发环境

### 环境要求

- Node.js >= 18.12.0
- Yarn >= 1.22.0
- MySQL >= 5.7
- Kafka >= 2.8.0
- Redis >= 6.0
- ClickHouse >= 24.8

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/ComfortableLiu/probe-x.git
cd probe-x

# 2. 安装依赖
yarn

# 3. 启动所有服务
yarn dev
```

### Docker 开发

```bash
# 1. 配置环境变量
cp .env.example .env

# 2. 启动所有服务
docker compose up -d --build

# 3. 查看服务状态
docker compose ps
```

## 项目结构

```
probe-x/
├── apps/
│   ├── frontend/                    # 前端服务
│   ├── web-sdk/                     # Web SDK
│   ├── ecommerce-demo/              # 电商演示
│   ├── data-dashboard-api-service/  # 数据仪表板 API
│   ├── receiving-point-service/     # 埋点接收服务
│   ├── preliminary-data-processing-service/  # 初步数据处理
│   └── final-data-cleaning-service/ # 最终数据清洗
├── libs/
│   ├── shared-types/                # 共享类型
│   └── shared-utils/                # 共享工具
├── docs/                            # 文档
├── test/                            # 测试
├── scripts/                         # 脚本
└── docker-compose.yml               # Docker 配置
```

## 联系方式

- GitHub Issues: [issues](https://github.com/ComfortableLiu/probe-x/issues)
- 邮箱: liuchengxu1994@gmail.com

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](./LICENSE) 文件。
