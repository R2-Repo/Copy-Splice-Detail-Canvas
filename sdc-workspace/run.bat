@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "SDC_REPO_ROOT=%~dp0.."
cd /d "%SDC_REPO_ROOT%"

echo.
echo  Splice Detail Canvas - auto layout workspace
echo  ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Install Node 20+ from https://nodejs.org
  pause
  exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python not found. Install Python 3.11+ from https://www.python.org/downloads/
  echo        Check "Add python.exe to PATH" during install.
  pause
  exit /b 1
)

if not exist "node_modules\tsx\dist\cli.mjs" (
  echo [1/2] Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
) else (
  echo [1/2] npm dependencies OK
)

echo [2/2] Installing Python sidecar...
python -m pip install -e "tools/sdc-sidecar" -q 2>nul
if errorlevel 1 (
  echo pip install failed. Try: python -m pip install -e "tools/sdc-sidecar"
  pause
  exit /b 1
)

echo.
echo Refreshing rules engine and running layout export...
echo   Rules: src/features/rules/*.ts ^(TypeScript — same as web app^)
echo.

set "SDC_REPO_ROOT=%CD%"
set "WORKSPACE_ARGS=%~dp0."
if /I "%~1"=="--deep" set "WORKSPACE_ARGS=%~dp0. --deep"

node scripts\sdc-workspace-run.mjs %WORKSPACE_ARGS%
set EXITCODE=%ERRORLEVEL%

echo.
if %EXITCODE% neq 0 (
  echo FAILED - see messages above.
) else (
  echo.
  echo SUCCESS - open the web app and use Import file on:
  echo   sdc-workspace\output\rank-1.sdc.json  ^(best^)
  echo   through rank-5.sdc.json if present
)
echo.
pause
exit /b %EXITCODE%
