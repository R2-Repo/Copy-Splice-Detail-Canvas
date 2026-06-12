@echo off
setlocal EnableExtensions

rem Run layout contract + typecheck + unit tests + production build.
rem Ensures Node.js is on PATH when launched from Cursor agent shell or double-click.

cd /d "%~dp0"

set "NODE_DIR=%ProgramFiles%\nodejs"
if exist "%NODE_DIR%\node.exe" (
  set "PATH=%NODE_DIR%;%PATH%"
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node 20+ LTS from https://nodejs.org/
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

call npm run test:layout
if errorlevel 1 exit /b 1

call npm run check
if errorlevel 1 exit /b 1

call npm run test:ci
if errorlevel 1 exit /b 1

call npm run build
if errorlevel 1 exit /b 1

echo.
echo verify: all gates passed.
exit /b 0
