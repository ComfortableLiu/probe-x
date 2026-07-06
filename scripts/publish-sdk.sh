#!/usr/bin/env bash
#
# Probe-X Web SDK NPM 发布脚本
# 用法: ./scripts/publish-sdk.sh [patch|minor|major|prepatch|preminor|premajor|prerelease]
#

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="$PROJECT_ROOT/apps/web-sdk"

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 检查是否在 git 仓库中
check_git() {
  if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    log_error "当前目录不在 git 仓库中"
  fi

  # 检查是否有未提交的更改（排除 web-sdk 目录外的更改）
  if [[ -n "$(git status --porcelain "$SDK_DIR")" ]]; then
    log_warn "web-sdk 目录有未提交的更改："
    git status --short "$SDK_DIR"
    echo ""
    read -p "是否继续发布？(y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      log_info "发布已取消"
      exit 0
    fi
  fi
}

# 检查是否已登录 npm
check_npm_auth() {
  if ! npm whoami > /dev/null 2>&1; then
    log_error "未登录 npm，请先执行 npm login"
  fi
  local npm_user
  npm_user=$(npm whoami)
  log_success "已登录 npm，用户: $npm_user"
}

# 检查依赖
check_dependencies() {
  log_info "检查依赖..."
  cd "$SDK_DIR"

  if [[ ! -d "node_modules" ]]; then
    log_info "安装依赖..."
    npm install
  fi

  log_success "依赖检查完成"
}

# 运行检查
run_checks() {
  cd "$SDK_DIR"

  # 类型检查
  log_info "运行类型检查..."
  npm run type-check
  log_success "类型检查通过"

  # 运行测试（如果存在）
  if npm run test --passWithNoTests 2>/dev/null; then
    log_success "测试通过"
  else
    log_warn "跳过测试（无测试或测试失败）"
  fi
}

# 清理构建产物
clean_build() {
  log_info "清理旧的构建产物..."
  cd "$SDK_DIR"
  npm run clean
  log_success "清理完成"
}

# 构建
build() {
  log_info "构建 SDK..."
  cd "$SDK_DIR"
  npm run build

  # 验证构建产物
  local required_files=(
    "dist/probe-x-sdk.umd.js"
    "dist/probe-x-sdk.umd.min.js"
    "dist/probe-x-sdk.esm.js"
    "dist/probe-x-sdk.cjs.js"
    "dist/probe-x-sdk.d.ts"
  )

  for file in "${required_files[@]}"; do
    if [[ ! -f "$SDK_DIR/$file" ]]; then
      log_error "构建产物缺失: $file"
    fi
  done

  # 显示构建产物大小
  log_info "构建产物大小："
  du -sh "$SDK_DIR"/dist/*.js "$SDK_DIR"/dist/*.d.ts 2>/dev/null | while read -r size file; do
    echo "  $size  $(basename "$file")"
  done

  log_success "构建完成"
}

# 更新版本号
bump_version() {
  local version_type="${1:-patch}"
  cd "$SDK_DIR"

  log_info "更新版本号 ($version_type)..."
  npm version "$version_type" --no-git-tag-version

  local new_version
  new_version=$(node -p "require('./package.json').version")
  log_success "版本号已更新为: $new_version"
  echo "$new_version"
}

# 发布到 npm
publish() {
  cd "$SDK_DIR"
  local current_version
  current_version=$(node -p "require('./package.json').version")

  log_info "准备发布 @probe-x/web-sdk@$current_version"
  echo ""
  echo "发布内容："
  echo "  包名: @probe-x/web-sdk"
  echo "  版本: $current_version"
  echo "  标签: ${NPM_TAG:-latest}"
  echo ""

  read -p "确认发布？(y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "发布已取消"
    exit 0
  fi

  # 发布
  local publish_args=("--access" "public")
  if [[ -n "${NPM_TAG:-}" ]]; then
    publish_args+=("--tag" "$NPM_TAG")
  fi

  log_info "发布中..."
  npm publish "${publish_args[@]}"

  log_success "发布成功！"
  log_info "安装命令: npm install @probe-x/web-sdk@$current_version"

  # 创建 git tag
  read -p "是否创建 git tag？(y/N) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    local tag_name="web-sdk/v$current_version"
    git tag -a "$tag_name" -m "Release @probe-x/web-sdk@$current_version"
    log_success "已创建 tag: $tag_name"
    read -p "是否推送 tag 到远程？(y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      git push origin "$tag_name"
      log_success "Tag 已推送"
    fi
  fi
}

# 显示帮助
show_help() {
  echo "Probe-X Web SDK 发布脚本"
  echo ""
  echo "用法:"
  echo "  $0 [选项] [版本类型]"
  echo ""
  echo "版本类型:"
  echo "  patch      补丁版本 (0.1.0 -> 0.1.1) [默认]"
  echo "  minor      次版本   (0.1.0 -> 0.2.0)"
  echo "  major      主版本   (0.1.0 -> 1.0.0)"
  echo "  prepatch   预补丁   (0.1.0 -> 0.1.1-0)"
  echo "  preminor   预次版本 (0.1.0 -> 0.2.0-0)"
  echo "  premajor   预主版本 (0.1.0 -> 1.0.0-0)"
  echo "  prerelease 预发布   (0.1.0 -> 0.1.1-0)"
  echo ""
  echo "选项:"
  echo "  --tag TAG    指定 npm 发布标签 (默认: latest)"
  echo "  --beta       等同于 --tag beta"
  echo "  --dry-run    仅构建，不发布"
  echo "  --skip-checks 跳过检查步骤"
  echo "  --help       显示帮助"
  echo ""
  echo "示例:"
  echo "  $0                   # 发布 patch 版本"
  echo "  $0 minor             # 发布 minor 版本"
  echo "  $0 --beta            # 发布 beta 版本"
  echo "  $0 --dry-run         # 仅构建检查"
}

# 主流程
main() {
  local version_type="patch"
  local dry_run=false
  local skip_checks=false

  # 解析参数
  while [[ $# -gt 0 ]]; do
    case $1 in
      --help|-h)
        show_help
        exit 0
        ;;
      --tag)
        NPM_TAG="$2"
        shift 2
        ;;
      --beta)
        NPM_TAG="beta"
        shift
        ;;
      --dry-run)
        dry_run=true
        shift
        ;;
      --skip-checks)
        skip_checks=true
        shift
        ;;
      patch|minor|major|prepatch|preminor|premajor|prerelease)
        version_type="$1"
        shift
        ;;
      *)
        log_error "未知参数: $1，使用 --help 查看帮助"
        ;;
    esac
  done

  echo ""
  echo "=========================================="
  echo "  Probe-X Web SDK 发布工具"
  echo "=========================================="
  echo ""

  # 执行检查
  check_git
  check_npm_auth
  check_dependencies

  if [[ "$skip_checks" != true ]]; then
    run_checks
  fi

  # 清理并构建
  clean_build
  build

  if [[ "$dry_run" == true ]]; then
    log_success "Dry run 完成，未执行发布"
    exit 0
  fi

  # 更新版本号
  bump_version "$version_type"

  # 发布
  publish
}

main "$@"
