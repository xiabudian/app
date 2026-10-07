@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   AI 聊天助手 - 启动网页版
echo ============================================
echo   本机访问:  http://localhost:5173
echo   手机访问:  启动后用下面提示的 Network 地址
echo              (手机要和电脑连同一个 WiFi)
echo   停止:      在本窗口按 Ctrl+C
echo ============================================
echo.
call npm run dev
echo.
echo 开发服务器已退出。
pause
