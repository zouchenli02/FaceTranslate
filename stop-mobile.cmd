@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-mobile.ps1"
if errorlevel 1 (
  echo.
  echo Stop failed. See the message above.
  pause
  exit /b 1
)
pause

