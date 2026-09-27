@echo off
cd /d "%~dp0"
if not exist "node_modules\.bin\live-server.cmd" (
  echo [Ошибка] Нет node_modules. Установите зависимости одним из способов:
  echo   1^) Откройте cmd.exe ^(не PowerShell^) и выполните: npm install
  echo   2^) Или в PowerShell: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  echo      затем снова: npm install
  pause
  exit /b 1
)
call node_modules\.bin\live-server.cmd . --port=5500 --open=/index.html
