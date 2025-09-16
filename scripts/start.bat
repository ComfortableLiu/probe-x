@echo off
setlocal enabledelayedexpansion

REM Probe-X 项目启动脚本 (Windows)
REM 使用方法: scripts\start.bat [选项]

title Probe-X 项目启动脚本

REM 显示帮助信息
:show_help
echo.
echo ================================
echo   Probe-X 项目启动脚本
echo ================================
echo.
echo 使用方法: %0 [选项]
echo.
echo 选项:
echo   all                启动所有服务
echo   frontend           只启动前端服务
echo   backend            只启动后端服务
echo   receiving-point    启动埋点接收服务
echo   dashboard-api      启动数据仪表板API服务
echo   preliminary        启动初步数据处理服务
echo   final-cleaning     启动最终数据清洗服务
echo   dev                开发模式启动所有服务
echo   build              构建所有服务
echo   clean              清理构建文件
echo   status             查看服务状态
echo   stop               停止所有服务
echo   restart            重启所有服务
echo   help               显示此帮助信息
echo.
echo 示例:
echo   %0 all              # 启动所有服务
echo   %0 frontend         # 只启动前端
echo   %0 backend          # 只启动后端服务
echo   %0 dev              # 开发模式
echo.
goto :eof

REM 检查依赖
:check_dependencies
echo [INFO] 检查依赖...
where yarn >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Yarn 未安装，请先安装 Yarn
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js 未安装，请先安装 Node.js
    exit /b 1
)

echo [INFO] 依赖检查完成
goto :eof

REM 安装依赖
:install_dependencies
echo [INFO] 安装项目依赖...
call yarn install
if %errorlevel% neq 0 (
    echo [ERROR] 依赖安装失败
    exit /b 1
)
echo [INFO] 依赖安装完成
goto :eof

REM 启动所有服务
:start_all
echo [INFO] 启动所有服务...
call yarn dev
goto :eof

REM 启动前端
:start_frontend
echo [INFO] 启动前端服务...
call yarn dev:frontend
goto :eof

REM 启动后端
:start_backend
echo [INFO] 启动后端服务...
call yarn dev:backend
goto :eof

REM 启动单个服务
:start_service
set service=%1
if "%service%"=="receiving-point" (
    echo [INFO] 启动埋点接收服务...
    call yarn start:receiving-point
) else if "%service%"=="dashboard-api" (
    echo [INFO] 启动数据仪表板API服务...
    call yarn start:dashboard-api
) else if "%service%"=="preliminary" (
    echo [INFO] 启动初步数据处理服务...
    call yarn start:preliminary-processing
) else if "%service%"=="final-cleaning" (
    echo [INFO] 启动最终数据清洗服务...
    call yarn start:final-cleaning
) else (
    echo [ERROR] 未知的服务: %service%
    call :show_help
    exit /b 1
)
goto :eof

REM 构建项目
:build_project
echo [INFO] 构建项目...
call yarn build:sequence
if %errorlevel% neq 0 (
    echo [ERROR] 构建失败
    exit /b 1
)
echo [INFO] 构建完成
goto :eof

REM 清理项目
:clean_project
echo [INFO] 清理项目...
call yarn clean
echo [INFO] 清理完成
goto :eof

REM 查看服务状态
:show_status
echo [INFO] 查看服务状态...
call yarn status
goto :eof

REM 停止服务
:stop_services
echo [INFO] 停止所有服务...
call yarn stop:all
echo [INFO] 服务已停止
goto :eof

REM 重启服务
:restart_services
echo [INFO] 重启所有服务...
call yarn restart:all
goto :eof

REM 开发模式
:dev_mode
echo [INFO] 开发模式启动...
call yarn dev
goto :eof

REM 主函数
:main
if "%1"=="" (
    call :show_help
    exit /b 0
)

call :check_dependencies
if %errorlevel% neq 0 exit /b 1

if "%1"=="all" (
    call :install_dependencies
    if %errorlevel% neq 0 exit /b 1
    call :start_all
) else if "%1"=="frontend" (
    call :install_dependencies
    if %errorlevel% neq 0 exit /b 1
    call :start_frontend
) else if "%1"=="backend" (
    call :install_dependencies
    if %errorlevel% neq 0 exit /b 1
    call :start_backend
) else if "%1"=="receiving-point" (
    call :install_dependencies
    if %errorlevel% neq 0 exit /b 1
    call :start_service %1
) else if "%1"=="dashboard-api" (
    call :install_dependencies
    if %errorlevel% neq 0 exit /b 1
    call :start_service %1
) else if "%1"=="preliminary" (
    call :install_dependencies
    if %errorlevel% neq 0 exit /b 1
    call :start_service %1
) else if "%1"=="final-cleaning" (
    call :install_dependencies
    if %errorlevel% neq 0 exit /b 1
    call :start_service %1
) else if "%1"=="dev" (
    call :install_dependencies
    if %errorlevel% neq 0 exit /b 1
    call :dev_mode
) else if "%1"=="build" (
    call :install_dependencies
    if %errorlevel% neq 0 exit /b 1
    call :build_project
) else if "%1"=="clean" (
    call :clean_project
) else if "%1"=="status" (
    call :show_status
) else if "%1"=="stop" (
    call :stop_services
) else if "%1"=="restart" (
    call :restart_services
) else if "%1"=="help" (
    call :show_help
) else if "%1"=="-h" (
    call :show_help
) else if "%1"=="--help" (
    call :show_help
) else (
    echo [ERROR] 未知选项: %1
    call :show_help
    exit /b 1
)

goto :eof

REM 执行主函数
call :main %*
