@echo off
REM Launcher installed by the Windows installer. Uses the bundled portable Node
REM if present (companion ships with one), otherwise falls back to a Node on PATH.
setlocal
set "DIR=%~dp0"
set "WORKSPACE=%USERPROFILE%\CrewCanvasWorkspace"
if not exist "%WORKSPACE%" mkdir "%WORKSPACE%"

set "NODE=node"
if exist "%DIR%node\node.exe" set "NODE=%DIR%node\node.exe"

echo Starting CrewCanvas Companion...
echo Workspace: %WORKSPACE%
echo.
"%NODE%" "%DIR%server.mjs" --workspace "%WORKSPACE%"
echo.
echo Companion stopped. Close this window or press a key.
pause >nul
