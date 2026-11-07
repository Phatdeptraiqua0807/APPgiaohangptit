@echo off
chcp 65001 >nul
title ptitngon - Local AI Proxy Server
cd /d "%~dp0"
echo Đang khởi động ptitngon Local Proxy Server tại http://localhost:3000 ...
start "" "http://localhost:3000"
node server.js
pause

