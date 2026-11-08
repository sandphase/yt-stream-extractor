# YTDown Studio — Pro Stream Extractor & Audio/Video Mastering Suite

Plataforma web full-stack de extracción y masterización de streams multimedia desarrollada en **Go (Golang)**, **FFmpeg** y **React 18**. Diseñada para extraer audio y video desde YouTube con alta velocidad, normalización de sonoridad de estudio y entrega directa al navegador del usuario.

---

## Características Principales

### 1. Motor de Extracción Híbrido de Alta Velocidad
- **Resolución Multi-Nodo & Fallback:** Combina resolución directa de streams distribuidos (`invidious_engine.go`) con `yt-dlp` para máxima disponibilidad y resistencia frente a bloqueos o límites de tasa.
- **Análisis Instantáneo de Metadatos:** Resolución ultrarrápida de título, canal, miniatura y duración mediante oEmbed y motores de extracción en segundo plano.

### 2. Masterización de Audio y Video con FFmpeg
- **Perfiles de Audio de Estudio:**
  - `MP3 320kbps` (Master Studio)
  - `FLAC` (Lossless 24-bit)
  - `M4A` (AAC 256kbps)
  - `WAV` (Raw Studio PCM)
- **Procesamiento DSP:** Normalización de sonoridad broadcast **EBU R128 (`-14 LUFS`)** e incrustación de metadatos.
- **Perfiles de Video:** Descarga y remuxing en contenedores `MP4`, `MKV` y `WebM` (calidad máxima original, `4K 2160p`, `1080p Full HD` y `720p HD`).

### 3. Descarga Automática y Aislamiento por Dispositivo
- **Auto-Descarga al Completar (100%):** En cuanto el backend finaliza la extracción y masterización, el navegador inicia automáticamente la descarga del archivo hacia la PC o dispositivo móvil del usuario.
- **Aislamiento de Sesión por Cliente:** Cada navegador mantiene el registro exclusivo de sus propios trabajos activos y su biblioteca personal (*Mis Descargas*), evitando colisiones o descargas cruzadas entre distintos usuarios conectados simultáneamente.

### 4. Extracción por Lotes (Batch Mode)
- Encolado masivo de múltiples enlaces de YouTube (uno por línea) para procesamiento concurrente en segundo plano en formato Audio o Video.

### 5. Seguridad y Hardening para Entornos Públicos
- **Cero Exposición de Infraestructura:** Las respuestas de la API y WebSockets sanitizan cualquier ruta interna del sistema de archivos (`filePath`, `outputDir`) y omiten telemetría sensible del servidor.
- **Endpoints Blindados:** Bloqueo de escritura en rutas arbitrarias del servidor y deshabilitación de carga externa de credenciales/cookies vía HTTP.

---

## Requisitos del Sistema

1. **[Go 1.22+](https://go.dev/)**: Motor principal del backend y API concurrente.
2. **[FFmpeg](https://ffmpeg.org/)**: Indispensable para la transcodificación de audio, normalización EBU R128 y muxing de contenedores de video.
3. **[yt-dlp](https://github.com/yt-dlp/yt-dlp)**: Motor secundario de extracción (soportado en el `PATH` del sistema o en `./tools/bin/`).
4. **[Node.js 18+](https://nodejs.org/)**: Utilizado para empaquetar el frontend con `esbuild` y ejecutar los scripts de arranque.

---

## Guía de Inicio Rápido

### Opción A: Ejecución Directa (Producción / Linux)

```bash
# 1. Compilar el bundle de producción del frontend (React JSX -> JS optimizado)
npx esbuild web/assets/app.jsx --bundle --outfile=web/assets/app.js --jsx=transform

# 2. Compilar el binario del servidor Go
go build -o bin/server ./cmd/server

# 3. Iniciar el servidor (sirve API, WebSockets y UI en el puerto 8090)
./bin/server
```

### Opción B: Scripts Automáticos de Desarrollo

- **Linux / macOS:**
  ```bash
  chmod +x start.sh && ./start.sh
  ```
- **Windows:**
  Ejecuta `start.bat`.

---

## Arquitectura del Proyecto

```txt
yt-stream-extractor/
├── cmd/
│   ├── server/                     # Punto de entrada del servidor HTTP/WebSocket en Go
│   └── cli/                        # Utilidad de línea de comandos
├── internal/
│   ├── config/                     # Configuración de entorno y rutas seguras
│   ├── database/                   # Inicialización y migraciones de SQLite
│   ├── handlers/                   # Controladores HTTP REST y descarga de archivos
│   ├── models/                     # Contratos de datos y sanitización JSON
│   ├── repository/                 # Capa de persistencia SQLite
│   └── services/
│       ├── invidious_engine.go     # Motor de extracción directa de streams y FFmpeg
│       ├── youtube_service.go      # Orquestador de análisis y extracción multimedia
│       ├── job_manager.go          # Cola concurrente de trabajos y estados
│       └── ws_hub.go               # Hub de notificaciones en tiempo real vía WebSocket
├── web/
│   ├── index.html                  # Shell de la aplicación web
│   └── assets/
│       ├── app.jsx                 # Código fuente de la UI en React 18 + Tailwind CSS
│       └── app.js                  # Bundle precompilado con esbuild para producción
└── downloads/                      # Almacenamiento temporal de archivos procesados
```

---

## Endpoints Principales de la API

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/analyze` | Analiza una URL de YouTube y devuelve título, miniatura, duración y formatos. |
| `POST` | `/api/downloads` | Encola un nuevo trabajo de extracción y masterización de audio o video. |
| `POST` | `/api/downloads/batch` | Encola múltiples URLs para extracción por lotes. |
| `GET` | `/api/status?id={id}` | Consulta el progreso en tiempo real (`progress`, `speed`, `eta`, `state`) de un trabajo. |
| `GET` | `/api/downloads/file?id={id}` | Descarga el archivo final procesado con cabeceras `Content-Disposition: attachment`. |
| `GET` | `/api/history` | Lista los registros de descargas disponibles. |
| `DELETE` | `/api/history/{id}` | Elimina un registro de la base de datos y su archivo físico asociado. |
| `GET` | `/ws` | Canal WebSocket para telemetría de progreso de trabajos en tiempo real. |
| `GET` | `/health` | Verificación de estado del servicio (`{"status": "ok"}`). |
