@echo off
setlocal EnableExtensions EnableDelayedExpansion

set ROOT=%~dp0
set TOOLS=%ROOT%tools\bin
set TMP=%ROOT%tools\tmp

if not exist "%TOOLS%" mkdir "%TOOLS%"
if not exist "%TMP%" mkdir "%TMP%"

echo [YTDown Setup] Descargando yt-dlp...
if not exist "%TOOLS%\yt-dlp.exe" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -OutFile '%TOOLS%\yt-dlp.exe'"
)

echo [YTDown Setup] Descargando ffmpeg...
if not exist "%TOOLS%\ffmpeg.exe" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip -OutFile '%TMP%\ffmpeg.zip'"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%TMP%\ffmpeg.zip' -DestinationPath '%TMP%\ffmpeg' -Force"
  for /r "%TMP%\ffmpeg" %%F in (ffmpeg.exe) do copy /Y "%%F" "%TOOLS%\ffmpeg.exe" >nul
  for /r "%TMP%\ffmpeg" %%F in (ffprobe.exe) do copy /Y "%%F" "%TOOLS%\ffprobe.exe" >nul
)

echo [YTDown Setup] Verificando dependencias de IA (Python, Whisper, Spleeter)...
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [YTDown Setup] ADVERTENCIA: Python no encontrado. Las funciones de IA requieren Python instalado.
) else (
  echo [YTDown Setup] Verificando Whisper...
  where whisper >nul 2>nul
  if %ERRORLEVEL% neq 0 (
    echo [YTDown Setup] Instalando Whisper via pip...
    pip install -U openai-whisper
  )
  echo [YTDown Setup] Verificando Spleeter...
  where spleeter >nul 2>nul
  if %ERRORLEVEL% neq 0 (
    echo [YTDown Setup] Instalando Spleeter via pip...
    pip install spleeter
  )
  echo [YTDown Setup] Agregando Python Scripts al PATH del usuario...
  for /f "delims=" %%P in ('python -c "import sysconfig; print(sysconfig.get_path(\"scripts\"))"') do (
    powershell -NoProfile -Command "[System.Environment]::SetEnvironmentVariable('Path', [System.Environment]::GetEnvironmentVariable('Path','User') + ';%%P', 'User')"
  )
  echo [YTDown Setup] Configurando PYTHONUTF8 para compatibilidad con Python 3.14...
  powershell -NoProfile -Command "[System.Environment]::SetEnvironmentVariable('PYTHONUTF8','1','User')"
)


set PATH=%TOOLS%;%PATH%
echo [YTDown Setup] Listo. Binarios en %TOOLS%
exit /b 0
