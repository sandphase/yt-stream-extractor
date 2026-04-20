#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$ROOT_DIR/tools/bin"
TMP_DIR="$ROOT_DIR/tools/tmp"

mkdir -p "$TOOLS_DIR" "$TMP_DIR"

echo "[YTDown Setup] Descargando yt-dlp..."
if [[ ! -f "$TOOLS_DIR/yt-dlp" ]]; then
  curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" -o "$TOOLS_DIR/yt-dlp"
  chmod +x "$TOOLS_DIR/yt-dlp"
fi

echo "[YTDown Setup] Descargando ffmpeg static..."
if [[ ! -f "$TOOLS_DIR/ffmpeg" ]]; then
  curl -L "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz" -o "$TMP_DIR/ffmpeg.tar.xz"
  tar -xJf "$TMP_DIR/ffmpeg.tar.xz" -C "$TMP_DIR"
  FFMPEG_PATH="$(find "$TMP_DIR" -type f -name ffmpeg | head -n 1)"
  FFPROBE_PATH="$(find "$TMP_DIR" -type f -name ffprobe | head -n 1)"
  cp "$FFMPEG_PATH" "$TOOLS_DIR/ffmpeg"
  cp "$FFPROBE_PATH" "$TOOLS_DIR/ffprobe"
  chmod +x "$TOOLS_DIR/ffmpeg" "$TOOLS_DIR/ffprobe"
fi

echo "[YTDown Setup] Verificando dependencias de IA (Python, Whisper, Spleeter)..."
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
  echo "[YTDown Setup] ADVERTENCIA: Python no encontrado. Las funciones de IA requieren Python instalado."
else
  PYTHON_BIN=$(command -v python3 || command -v python)
  echo "[YTDown Setup] Verificando Whisper..."
  if ! command -v whisper &> /dev/null; then
    echo "[YTDown Setup] Instalando Whisper via pip..."
    $PYTHON_BIN -m pip install -U openai-whisper
  fi
  echo "[YTDown Setup] Verificando Spleeter..."
  if ! command -v spleeter &> /dev/null; then
    echo "[YTDown Setup] Instalando Spleeter via pip..."
    $PYTHON_BIN -m pip install spleeter
  fi
fi

export PATH="$TOOLS_DIR:$PATH"
echo "[YTDown Setup] Listo. Binarios en $TOOLS_DIR"
