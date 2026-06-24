@echo off
setlocal EnableExtensions

rem Start or restart the Vite dev server for Splice Detail Canvas.
rem Kills any existing Vite dev servers, launches this repo hidden, opens Chrome, then exits.
rem Double-click this file, or run from any folder: path\to\start-dev.bat

cd /d "%~dp0"

set "PORT=5173"
set "DEV_PORT=%PORT%"
set "URL=http://localhost:%PORT%/"
set "TITLE=Splice Detail Canvas Dev"
set "PID_FILE=%~dp0.dev-server.pid"

rem Strip trailing backslash for PowerShell paths.
set "REPO_DIR=%~dp0"
if "%REPO_DIR:~-1%"=="\" set "REPO_DIR=%REPO_DIR:~0,-1%"

rem Ensure Node.js is on PATH when launched from Explorer or Cursor agent shell.
set "NODE_DIR=%ProgramFiles%\nodejs"
if exist "%NODE_DIR%\node.exe" (
  set "PATH=%NODE_DIR%;%PATH%"
)

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Node.js was not found on PATH.
  echo Install Node 20 LTS from https://nodejs.org/ then run this script again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Stopping existing dev servers...
call :kill_dev_servers

rem Brief pause so ports are released before Vite binds again.
ping 127.0.0.1 -n 2 >nul

echo Starting dev server for this repo at %URL%
call :start_dev_server_hidden

echo Waiting for this repo on port %PORT%...
call :wait_for_this_repo
if errorlevel 1 (
  echo Timed out waiting for this repo on port %PORT%. Open %URL% manually when ready.
  exit /b 1
)

call :clear_foreign_listeners
call :save_dev_server_pid

rem Give Vite a moment to finish startup after the port binds.
ping 127.0.0.1 -n 2 >nul

call :clear_foreign_listeners
call :open_chrome_incognito "%URL%"
exit 0

:start_dev_server_hidden
rem No visible terminal window — Vite runs hidden in the background.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$repo = $env:REPO_DIR;" ^
  "Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','dev','--','--port',$env:DEV_PORT,'--strictPort','--host','0.0.0.0') -WorkingDirectory $repo -WindowStyle Hidden | Out-Null"
if errorlevel 1 (
  echo Failed to start dev server.
  pause
  exit /b 1
)
exit /b 0

:save_dev_server_pid
rem Remember the listening node PID so the next run can stop this instance quickly.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'SilentlyContinue';" ^
  "$port = [int]$env:DEV_PORT;" ^
  "$repo = $env:REPO_DIR;" ^
  "$serverPid = (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |" ^
  "  ForEach-Object { Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.OwningProcess) -ErrorAction SilentlyContinue } |" ^
  "  Where-Object { $_.CommandLine -like ('*' + $repo + '*') } |" ^
  "  Select-Object -First 1 -ExpandProperty ProcessId);" ^
  "if ($serverPid) { Set-Content -LiteralPath $env:PID_FILE -Value $serverPid -NoNewline }"
exit /b 0

:kill_dev_servers
rem Close any leftover dev terminal windows from older versions of this script.
taskkill /FI "WINDOWTITLE eq %TITLE%*" /F >nul 2>&1

rem Stop the dev server PID recorded by the last run.
if exist "%PID_FILE%" (
  for /f "usebackq delims=" %%I in ("%PID_FILE%") do (
    echo Stopping prior dev server PID %%I ...
    taskkill /F /PID %%I /T >nul 2>&1
  )
  del /f /q "%PID_FILE%" >nul 2>&1
)

rem Kill listeners on common Vite ports and any node process running Vite.
call :kill_dev_servers_netstat
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'SilentlyContinue';" ^
  "5173..5185 | ForEach-Object {" ^
  "  Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue |" ^
  "    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" ^
  "};" ^
  "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" |" ^
  "  Where-Object { $_.CommandLine -match 'vite(\.js|\s)' -or $_.CommandLine -match 'npm(\.cmd)? run dev' } |" ^
  "  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
exit /b 0

:kill_dev_servers_netstat
rem Kill every process listening on common Vite ports (covers IPv4 and IPv6 bindings).
for /L %%N in (5173,1,5185) do (
  for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%%N .*LISTENING"') do (
    echo Stopping PID %%P on port %%N ...
    taskkill /F /PID %%P /T >nul 2>&1
  )
)
exit /b 0

:wait_for_this_repo
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'SilentlyContinue';" ^
  "$repo = $env:REPO_DIR; $port = [int]$env:DEV_PORT; $deadline = (Get-Date).AddSeconds(30);" ^
  "while ((Get-Date) -lt $deadline) {" ^
  "  $listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |" ^
  "    ForEach-Object { Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.OwningProcess) -ErrorAction SilentlyContinue } |" ^
  "    Where-Object { $_.CommandLine -like ('*' + $repo + '*') } | Select-Object -First 1;" ^
  "  if ($listening) { exit 0 };" ^
  "  Start-Sleep -Seconds 1" ^
  "}; exit 1"
exit /b %ERRORLEVEL%

:clear_foreign_listeners
rem Drop any other project's dev server that grabbed the port after we started.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'SilentlyContinue';" ^
  "$repo = $env:REPO_DIR; $port = [int]$env:DEV_PORT;" ^
  "Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {" ^
  "  $proc = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.OwningProcess) -ErrorAction SilentlyContinue;" ^
  "  if ($proc -and ($proc.CommandLine -notlike ('*' + $repo + '*'))) {" ^
  "    Write-Host ('Removing foreign dev server PID ' + $proc.ProcessId);" ^
  "    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue" ^
  "  }" ^
  "}"
exit /b 0

:open_chrome_incognito
set "OPEN_URL=%~1"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo Google Chrome was not found. Open %OPEN_URL% manually in an incognito window.
  exit /b 1
)
echo Opening Chrome incognito: %OPEN_URL%
start "" "%CHROME%" --incognito "%OPEN_URL%"
exit /b 0
