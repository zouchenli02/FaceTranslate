@echo off
setlocal
cd /d "%~dp0"
set "NODE_EXE="
for /f "delims=" %%I in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes" for /r "%USERPROFILE%\.cache\codex-runtimes" %%I in (node.exe) do if not defined NODE_EXE set "NODE_EXE=%%I"
if not defined NODE_EXE (
  echo Node.js was not found in PATH or the Codex runtime cache.
  echo Install Node.js 22 or later, then run this file again.
  pause
  exit /b 1
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-mobile.ps1" -NodePath "%NODE_EXE%"
if errorlevel 1 (
  echo.
  echo Start failed. See the message above.
  pause
  exit /b 1
)
echo.
echo Mobile debugging is running. Keep this computer online.
echo Use ONLY the current address shown below:
echo.
type "%~dp0.debug\OPEN-THIS-URL.txt"
echo.
pause
