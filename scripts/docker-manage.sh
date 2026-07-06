#!/bin/bash
# Probe-X Docker 管理脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    cat << EOF
Probe-X Docker 管理脚本

用法: ./scripts/docker-manage.sh [命令]

命令:
  start       启动所有服务
  stop        停止所有服务
  restart     重启所有服务
  status      查看服务状态
  logs        查看服务日志
  build       构建所有服务
  clean       清理所有服务和数据
  backup      备份数据
  restore     恢复数据
  help        显示帮助信息

示例:
  ./scripts/docker-manage.sh start
  ./scripts/docker-manage.sh logs data-dashboard-api-service
  ./scripts/docker-manage.sh backup
EOF
}

# 检查 Docker 是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi

    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
}

# 检查环境变量文件
check_env() {
    if [ ! -f .env ]; then
        print_warning ".env 文件不存在，正在从 .env.example 复制..."
        cp .env.example .env
        print_warning "请编辑 .env 文件配置环境变量"
    fi
}

# 启动服务
start_services() {
    print_info "启动 Probe-X 服务..."
    check_env
    docker compose up -d --build
    print_success "服务启动完成！"
    print_info "前端访问地址: http://localhost"
    print_info "API 服务地址: http://localhost:8101/api"
    echo ""
    print_info "使用 'docker compose ps' 查看服务状态"
    print_info "使用 'docker compose logs -f' 查看服务日志"
}

# 停止服务
stop_services() {
    print_info "停止 Probe-X 服务..."
    docker compose down
    print_success "服务已停止"
}

# 重启服务
restart_services() {
    print_info "重启 Probe-X 服务..."
    docker compose restart
    print_success "服务重启完成"
}

# 查看服务状态
show_status() {
    print_info "Probe-X 服务状态:"
    docker compose ps
}

# 查看日志
show_logs() {
    if [ -z "$1" ]; then
        docker compose logs -f
    else
        docker compose logs -f "$1"
    fi
}

# 构建服务
build_services() {
    print_info "构建 Probe-X 服务..."
    docker compose build
    print_success "构建完成"
}

# 清理服务和数据
clean_all() {
    print_warning "即将删除所有服务和数据，此操作不可恢复！"
    read -p "确认继续？(y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "停止并删除服务..."
        docker compose down -v --remove-orphans
        print_info "清理 Docker 缓存..."
        docker system prune -f
        print_success "清理完成"
    else
        print_info "已取消清理操作"
    fi
}

# 备份数据
backup_data() {
    BACKUP_DIR="./backups"
    DATE=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/$DATE"

    print_info "创建备份目录: $BACKUP_PATH"
    mkdir -p "$BACKUP_PATH"

    # 备份 MySQL
    print_info "备份 MySQL 数据..."
    docker compose exec -T mysql mysqldump -u root -p"${MYSQL_ROOT_PASSWORD:-probe_x_root_2024}" "${DB_DATABASE:-probe_x}" | gzip > "$BACKUP_PATH/mysql.sql.gz"

    # 备份 ClickHouse
    print_info "备份 ClickHouse 数据..."
    docker compose exec -T clickhouse clickhouse-backup create "backup_$DATE" 2>/dev/null || print_warning "ClickHouse 备份需要安装 clickhouse-backup"

    print_success "备份完成: $BACKUP_PATH"
}

# 恢复数据
restore_data() {
    if [ -z "$1" ]; then
        print_error "请指定备份目录"
        echo "用法: ./scripts/docker-manage.sh restore <备份目录>"
        exit 1
    fi

    BACKUP_PATH="$1"

    if [ ! -d "$BACKUP_PATH" ]; then
        print_error "备份目录不存在: $BACKUP_PATH"
        exit 1
    fi

    print_warning "即将恢复数据，现有数据将被覆盖！"
    read -p "确认继续？(y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # 恢复 MySQL
        if [ -f "$BACKUP_PATH/mysql.sql.gz" ]; then
            print_info "恢复 MySQL 数据..."
            gunzip -c "$BACKUP_PATH/mysql.sql.gz" | docker compose exec -T mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD:-probe_x_root_2024}" "${DB_DATABASE:-probe_x}"
        fi

        print_success "数据恢复完成"
    else
        print_info "已取消恢复操作"
    fi
}

# 主函数
main() {
    check_docker

    case "${1:-help}" in
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "$2"
            ;;
        build)
            build_services
            ;;
        clean)
            clean_all
            ;;
        backup)
            backup_data
            ;;
        restore)
            restore_data "$2"
            ;;
        help|*)
            show_help
            ;;
    esac
}

main "$@"
