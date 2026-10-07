@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   AI 聊天助手 - 云打包 (GitHub Actions)
echo ============================================

git status --porcelain | findstr . >nul
if not errorlevel 1 (
  echo [1/3] 提交本地改动...
  git add -A
  git commit -m "update: %date% %time%"
) else (
  echo [1/3] 没有未提交的改动，直接推送
)

echo [2/3] 推送到 GitHub...
git push origin main
if errorlevel 1 (
  echo       直连失败，改用代理 127.0.0.1:7897 重试...
  git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin main
  if errorlevel 1 (
    echo.
    echo 推送失败：请检查网络后重新运行本脚本。
    pause
    exit /b 1
  )
)

for /f %%i in ('git rev-parse --short HEAD') do set SHORT=%%i
for /f "delims=" %%u in ('git remote get-url origin') do set REPO=%%u
echo [3/3] 已推送，本次版本 %SHORT% ，等待云打包（最长 12 分钟，请勿关闭窗口）...
echo       下载页面: %REPO%
echo       (浏览器打开 - Actions - 最新一次运行 - Artifacts)

set /a tries=0
:wait
timeout /t 30 /nobreak >nul
set /a tries+=1
git fetch origin logs >nul 2>&1
for /f "delims=" %%m in ('git log origin/logs -1 --format=%%s 2^>nul') do set MSG=%%m
echo !MSG! | findstr /c:"-%SHORT%]" >nul
if errorlevel 1 (
  if !tries! geq 24 goto timeout
  echo   已等待 !tries! x 30 秒，仍在构建...
  goto wait
)
echo !MSG! | findstr "success" >nul
if not errorlevel 1 (
  echo.
  echo ============================================
  echo   打包成功！APK 文件名含 %SHORT%
  echo   到 Actions 页面 Artifacts 区下载安装
  echo ============================================
) else (
  echo.
  echo ============================================
  echo   打包失败：!MSG!
  echo   详细日志见 Actions 页面该次运行
  echo ============================================
)
pause
exit /b 0

:timeout
echo.
echo 等待超时：12 分钟还没出结果，稍后自己到 Actions 页面查看。
pause
