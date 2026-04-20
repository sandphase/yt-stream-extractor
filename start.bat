@echo off
setlocal EnableExtensions
cd /d "%~dp0."

set "BACK_PORT=8090"
set "FRONT_PORT=3000"

echo [YTDown] Reiniciando: liberando puertos %BACK_PORT% y %FRONT_PORT%...
for %%P in (%BACK_PORT% %FRONT_PORT%) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort %%P -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul
)
for %%P in (%BACK_PORT% %FRONT_PORT%) do (
  for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%%P " ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
)
timeout /t 1 /nobreak >nul

if exist "setup.bat" (
  echo [YTDown] Ejecutando setup.bat...
  call "setup.bat"
)

echo [YTDown] Backend (Go) en puerto %BACK_PORT%...
start "YTDown Backend" /MIN /D "%CD%" cmd /k "set PATH=%~dp0tools\bin;%PATH% && go run ./cmd/server"

timeout /t 2 /nobreak >nul

echo [YTDown] Frontend (serve carpeta web) en puerto %FRONT_PORT%...
start "YTDown Frontend" /MIN /D "%CD%" cmd /k "npx --yes serve web -l %FRONT_PORT% --no-clipboard"

echo.
echo UI:  http://127.0.0.1:%FRONT_PORT%/
echo API: http://127.0.0.1:%BACK_PORT%/health
echo Cierra las ventanas minimizadas o vuelve a ejecutar start.bat para reiniciar.
echo.
endlocal
exit /b 0
