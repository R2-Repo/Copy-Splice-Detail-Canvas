@echo off
setlocal EnableExtensions

rem Start or restart the Vite dev server for Splice Detail Canvas.
rem Double-click this file, or run from any folder: path\to\start-dev.bat

cd /d "%~dp0"

set "PORT=5173"
set "URL=http://localhost:%PORT%/"
set "TITLE=Splice Detail Canvas Dev"

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

echo Checking for an existing dev server on port %PORT%...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
  echo Stopping PID %%P ...
  taskkill /F /PID %%P >nul 2>&1
)

rem Brief pause so the port is released before Vite binds again.
ping 127.0.0.1 -n 2 >nul

echo Starting dev server at %URL%
start "%TITLE%" cmd /k "cd /d "%~dp0" && npm run dev"

echo Waiting for dev server...
call :wait_for_port %PORT%
if errorlevel 1 (
  echo Timed out waiting for port %PORT%. Open %URL% manually when ready.
  exit /b 1
)

rem Give Vite a moment to finish startup after the port binds.
ping 127.0.0.1 -n 2 >nul

call :open_chrome_incognito "%URL%"
goto :eof

:wait_for_port
set "WAIT_PORT=%~1"
set /a WAIT_TRIES=0
:wait_for_port_loop
netstat -ano | findstr ":%WAIT_PORT%" | findstr LISTENING >nul
if not errorlevel 1 exit /b 0
set /a WAIT_TRIES+=1
if %WAIT_TRIES% geq 30 exit /b 1
ping 127.0.0.1 -n 2 >nul
goto wait_for_port_loop

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
