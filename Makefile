# Probe-X Makefile
# Docker 管理快捷命令

.PHONY: help start stop restart status logs build clean backup restore

# 默认目标
help: ## 显示帮助信息
	@echo "Probe-X Docker 管理命令"
	@echo ""
	@echo "用法: make [命令]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# 服务管理
start: ## 启动所有服务
	@./scripts/docker-manage.sh start

stop: ## 停止所有服务
	@./scripts/docker-manage.sh stop

restart: ## 重启所有服务
	@./scripts/docker-manage.sh restart

status: ## 查看服务状态
	@./scripts/docker-manage.sh status

logs: ## 查看服务日志
	@./scripts/docker-manage.sh logs

logs-%: ## 查看指定服务日志 (例: make logs-data-dashboard-api-service)
	@./scripts/docker-manage.sh logs $*

# 构建
build: ## 构建所有服务
	@./scripts/docker-manage.sh build

build-%: ## 构建指定服务 (例: make build-data-dashboard-api-service)
	@docker compose build $*

# 数据管理
backup: ## 备份数据
	@./scripts/docker-manage.sh backup

restore: ## 恢复数据
	@./scripts/docker-manage.sh restore

clean: ## 清理所有服务和数据
	@./scripts/docker-manage.sh clean

# 开发工具
shell-%: ## 进入容器 shell (例: make shell-data-dashboard-api-service)
	@docker compose exec $* sh

db-shell: ## 进入 MySQL 命令行
	@docker compose exec mysql mysql -u root -p

clickhouse-shell: ## 进入 ClickHouse 命令行
	@docker compose exec clickhouse clickhouse-client

redis-shell: ## 进入 Redis 命令行
	@docker compose exec redis redis-cli -a $${REDIS_PASSWORD:-probe_x_redis_2024}

kafka-topics: ## 列出 Kafka topics
	@docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --list

# 健康检查
health: ## 检查所有服务健康状态
	@echo "=== Probe-X 服务健康状态 ==="
	@docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "=== 服务连接测试 ==="
	@docker compose exec -T data-dashboard-api-service curl -s http://localhost:8101/api/health || echo "API 服务未就绪"
	@docker compose exec -T frontend curl -s http://localhost:80/health || echo "前端服务未就绪"
