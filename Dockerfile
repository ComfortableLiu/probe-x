# Probe-X 后端服务通用 Dockerfile
# 使用多阶段构建优化镜像大小

# ==================== 构建阶段 ====================
FROM node:20-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache python3 make g++ git

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package.json yarn.lock ./
COPY apps/receiving-point-service/package.json ./apps/receiving-point-service/
COPY apps/preliminary-data-processing-service/package.json ./apps/preliminary-data-processing-service/
COPY apps/final-data-cleaning-service/package.json ./apps/final-data-cleaning-service/
COPY apps/data-dashboard-api-service/package.json ./apps/data-dashboard-api-service/
COPY libs/shared-types/package.json ./libs/shared-types/
COPY libs/shared-utils/package.json ./libs/shared-utils/

# 安装依赖
RUN yarn install --frozen-lockfile --production=false

# 复制源代码
COPY . .

# 构建参数：服务名称
ARG SERVICE_NAME

# 构建共享库
RUN yarn build:lib

# 构建指定服务
RUN yarn build:${SERVICE_NAME}

# ==================== 运行阶段 ====================
FROM node:20-alpine AS runner

# 安装运行时依赖
RUN apk add --no-cache curl dumb-init

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 设置工作目录
WORKDIR /app

# 从构建阶段复制产物
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# 复制 proto 文件（final-data-cleaning-service 需要）
ARG SERVICE_NAME
COPY --from=builder --chown=nodejs:nodejs /app/apps/${SERVICE_NAME}/proto ./proto 2>/dev/null || true

# 切换到非 root 用户
USER nodejs

# 暴露端口（默认值，会被环境变量覆盖）
EXPOSE 3000

# 使用 dumb-init 作为 PID 1 进程
ENTRYPOINT ["dumb-init", "--"]

# 启动服务（使用 shell 形式以支持变量替换）
CMD node dist/apps/${SERVICE_NAME}/main.js
