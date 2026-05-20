@echo off
cd /d C:\Users\Dell\Documents\Putzplan\pwa
start "Putziputzi Server" /D "C:\Users\Dell\Documents\Putzplan\pwa" cmd /k ""C:\Program Files\nodejs\node.exe" -e "eval(require('fs').readFileSync('server.js','utf8'))""
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8080
