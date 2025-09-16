#!/bin/bash

# Probe-X 项目启动脚本
# 使用方法: ./scripts/start.sh [选项]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Probe-X 项目启动脚本${NC}"
    echo -e "${BLUE}================================${NC}"
}

# 显示帮助信息
show_help() {
    echo "使用方法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  all                启动所有服务"
    echo "  frontend           只启动前端服务"
    echo "  backend            只启动后端服务"
    echo "  receiving-point    启动埋点接收服务"
    echo "  dashboard-api      启动数据仪表板API服务"
    echo "  preliminary        启动初步数据处理服务"
    echo "  final-cleaning     启动最终数据清洗服务"
    echo "  dev                开发模式启动所有服务"
    echo "  build              构建所有服务"
    echo "  clean              清理构建文件"
    echo "  status             查看服务状态"
    echo "  stop               停止所有服务"
    echo "  restart            重启所有服务"
    echo "  help               显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 all              # 启动所有服务"
    echo "  $0 frontend         # 只启动前端"
    echo "  $0 backend          # 只启动后端服务"
    echo "  $0 dev              # 开发模式"
}

# 检查依赖
check_dependencies() {
    print_message "检查依赖..."
    
    if ! command -v yarn &> /dev/null; then
        print_error "Yarn 未安装，请先安装 Yarn"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装，请先安装 Node.js"
        exit 1
    fi
    
    print_message "依赖检查完成"
}

# 安装依赖
install_dependencies() {
    print_message "安装项目依赖..."
    yarn install
    print_message "依赖安装完成"
}

# 启动所有服务
start_all() {
    print_message "启动所有服务..."
    yarn dev
}

# 启动前端
start_frontend() {
    print_message "启动前端服务..."
    yarn dev:frontend
}

# 启动后端
start_backend() {
    print_message "启动后端服务..."
    yarn dev:backend
}

# 启动单个服务
start_service() {
    local service=$1
    case $service in
        "receiving-point")
            print_message "启动埋点接收服务..."
            yarn start:receiving-point
            ;;
        "dashboard-api")
            print_message "启动数据仪表板API服务..."
            yarn start:dashboard-api
            ;;
        "preliminary")
            print_message "启动初步数据处理服务..."
            yarn start:preliminary-processing
            ;;
        "final-cleaning")
            print_message "启动最终数据清洗服务..."
            yarn start:final-cleaning
            ;;
        *)
            print_error "未知的服务: $service"
            show_help
            exit 1
            ;;
    esac
}

# 构建项目
build_project() {
    print_message "构建项目..."
    yarn build:sequence
    print_message "构建完成"
}

# 清理项目
clean_project() {
    print_message "清理项目..."
    yarn clean
    print_message "清理完成"
}

# 查看服务状态
show_status() {
    print_message "查看服务状态..."
    yarn status
}

# 停止服务
stop_services() {
    print_message "停止所有服务..."
    yarn stop:all
    print_message "服务已停止"
}

# 重启服务
restart_services() {
    print_message "重启所有服务..."
    yarn restart:all
}

# 开发模式
dev_mode() {
    print_message "开发模式启动..."
    yarn dev
}

# 主函数
main() {
    print_header
    
    # 检查参数
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    # 检查依赖
    check_dependencies
    
    # 处理命令
    case $1 in
        "all")
            install_dependencies
            start_all
            ;;
        "frontend")
            install_dependencies
            start_frontend
            ;;
        "backend")
            install_dependencies
            start_backend
            ;;
        "receiving-point"|"dashboard-api"|"preliminary"|"final-cleaning")
            install_dependencies
            start_service $1
            ;;
        "dev")
            install_dependencies
            dev_mode
            ;;
        "build")
            install_dependencies
            build_project
            ;;
        "clean")
            clean_project
            ;;
        "status")
            show_status
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            restart_services
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
}

# 捕获中断信号
trap 'print_warning "脚本被中断"; exit 1' INT TERM

# 执行主函数
main "$@"
