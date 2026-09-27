@echo off
cd /d "%~dp0"
if not exist "node_modules\.bin\serve.cmd" (
  echo [Ошибка] Нет node_modules. См. dev.cmd или установите: npm install ^(из cmd.exe^)
  pause
  exit /b 1
)
call node_modules\.bin\serve.cmd . -l 5501
