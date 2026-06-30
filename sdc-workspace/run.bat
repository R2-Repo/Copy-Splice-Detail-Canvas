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

if not exist "node_modules\tsx\dist\cli.mjs" (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

node scripts\sdc-workspace-run.mjs "%~dp0."
set EXITCODE=%ERRORLEVEL%

echo.
if %EXITCODE% neq 0 (
  echo FAILED - see messages above.
) else (
  echo Open the web app and use Import file on output\rank-1.sdc.json through rank-5.sdc.json
)
echo.
pause
exit /b %EXITCODE%
