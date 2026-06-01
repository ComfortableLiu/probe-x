#!/bin/bash
# Probe-X E2E 测试运行脚本
# 用法: cd /path/to/probe-x && bash test/run-e2e.sh

set -e
cd "$(dirname "$0")/.."

echo "========================================"
echo "  Probe-X E2E 测试 (Playwright + Firefox)"
echo "========================================"
echo ""

# 检查前端是否在运行 (port 8000)
if ! lsof -i :8000 > /dev/null 2>&1; then
  echo "⚠️  前端服务 (port 8000) 未运行"
  echo "   启动静态服务器: node test/static-server.js &"
  echo "   或使用开发模式: yarn start:frontend"
  echo ""
  read -p "是否启动静态服务器? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    node test/static-server.js &
    sleep 2
    echo "✅ 静态服务器已启动"
  else
    echo "退出。请先启动前端。"
    exit 1
  fi
else
  echo "✅ 前端服务 (port 8000) 已就绪"
fi

# 检查 Mock API 或真实后端是否在运行 (port 8101)
if ! lsof -i :8101 > /dev/null 2>&1; then
  echo "⚠️  后端 API (port 8101) 未运行"
  echo "   启动 Mock API 服务器: node test/mock-api-server.js &"
  echo ""
  read -p "是否启动 Mock API 服务器? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    node test/mock-api-server.js &
    sleep 1
    echo "✅ Mock API 服务器已启动"
  else
    echo "退出。请先启动后端或 Mock API。"
    exit 1
  fi
else
  echo "✅ 后端 API (port 8101) 已就绪"
fi

echo ""
echo "开始运行 Playwright E2E 测试..."
echo ""

npx playwright test --config=test/playwright.config.ts --reporter=list 2>&1

echo ""
if [ -d "test/test-reports" ]; then
  echo "📊 HTML 测试报告: test/test-reports/index.html"
fi
if [ -d "test/screenshots" ] && [ "$(ls -A test/screenshots 2>/dev/null)" ]; then
  echo "📸 截图: test/screenshots/ ($(ls test/screenshots/ | wc -l | tr -d ' ') 张)"
fi
echo ""
echo "运行完成！"
