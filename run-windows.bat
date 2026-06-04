@echo off
setlocal

title CrewCanvas
cd /d "%~dp0"

echo.
echo CrewCanvas Windows launcher
echo ===========================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install the LTS version from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Installing dependencies. This may take a few minutes the first time...
  call npm ci
  if errorlevel 1 (
    echo npm ci failed. Trying npm install instead...
    call npm install
  )
  if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    pause
    exit /b 1
  )
  echo.
)

echo Starting CrewCanvas...
echo The browser should open automatically. Keep this window open while using the app.
echo Press Ctrl+C in this window to stop the server.
echo.

call npm run dev -- --host 127.0.0.1 --open /

echo.
echo CrewCanvas stopped.
pause
