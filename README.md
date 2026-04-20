# 🚀 YTDown Studio_OS

Sistema integral de descarga, gestión y análisis neural de medios. Optimizado para YouTube y plataformas compatibles con `yt-dlp`.

---

## ⚡ Guía de Inicio Rápido

No necesitas configurar variables de entorno manualmente. El sistema está diseñado para ser **Zero-Config**.

1.  **Clona el repositorio** y entra en la carpeta.
2.  **Arranque Automático**:
    *   **Windows**: Haz doble clic en `start.bat`.
    *   **Linux/macOS**: Ejecuta `chmod +x start.sh && ./start.sh`.

> [!TIP]
> Al ejecutar `start.bat`, el sistema automáticamente llamará a `setup.bat` por ti si falta algo, liberará los puertos necesarios y arrancará el Backend (puerto 8090) y el Frontend (puerto 3000).

---

## 📋 Requisitos del Sistema (Pre-requisitos)

Para que el sistema funcione al **100%**, asegúrate de tener instalado:

1.  **[Node.js](https://nodejs.org/)**: Necesario para servir la interfaz web.
2.  **[Go (Golang)](https://go.dev/)**: El motor del backend.
3.  **[Python 3.10+](https://www.python.org/)**: **CRÍTICO** para las funciones de IA (Whisper/Spleeter).
    *   *Nota*: Durante la instalación de Python, marca la casilla **"Add Python to PATH"**.
4.  **[FFmpeg](https://ffmpeg.org/)**: Si el setup automático falla, asegúrate de tener `ffmpeg` accesible en tu terminal.

---

## 🧠 Funciones de IA (Neural Data Extraction)

Si deseas usar la **separación de pistas (Spleeter)** o **transcripción de audio (Whisper)**:

*   El sistema intentará instalarlos automáticamente vía `pip`.
*   Si usas **Python 3.14** en Windows, hemos implementado una corrección para el error de `UnicodeEncodeError`.
*   Asegúrate de tener una conexión a internet estable la primera vez, ya que Whisper descargará los modelos neuronales necesarios (aprox. 150MB para el modelo `base`).

---

## 📜 Gestión de Historial y Archivos

El sistema ahora incluye un control total sobre tus descargas pasadas:

*   **Pestaña de Historial**: Accede a todos tus registros guardados en SQLite.
*   **Eliminación Selectiva**:
    *   📜 **Borrar Registro**: Solo elimina la entrada de la base de datos.
    *   🗑️ **Borrar Todo**: Elimina el registro y **borra el archivo físico** del disco.
*   **Limpieza Masiva**: Botón para vaciar todo el historial de un solo clic.

---

## 🛠️ Solución de Problemas (Troubleshooting)

| Problema | Solución |
| :--- | :--- |
| **"Whisper no encontrado"** | Ejecuta `setup.bat` nuevamente. Si persiste, reinicia tu PC para que el PATH de Python se refresque. |
| **Error de Puerto (Bind error)** | El script `start.bat` intenta matar los procesos en los puertos 8090 y 3000 automáticamente. Si falla, cierra manualmente las ventanas de comando abiertas. |
| **Error de Codificación (Unicode)** | El sistema ya fuerza `PYTHONUTF8=1` internamente para evitar fallos en Windows. |
| **Descarga fallida** | Verifica que la URL es pública. `yt-dlp` se actualiza automáticamente con el setup para evitar bloqueos. |

---

## 📂 Arquitectura del Proyecto

```txt
YTDown/
├── cmd/
│   ├── server/           # Backend API Go
│   └── cli/              # Cliente de consola
├── internal/
│   ├── handlers/         # Gestión de rutas y lógica HTTP
│   ├── services/         # IA (Whisper/Spleeter) y YT-DLP
│   └── repository/       # Base de datos SQLite
├── web/
│   ├── index.html        # UI Estática (Tailwind/React)
│   └── assets/app.jsx    # Lógica del Frontend
├── tools/bin/            # Binarios autodescargados (yt-dlp, ffmpeg)
├── downloads/            # Carpeta por defecto de salida
└── setup.bat / .sh       # Instaladores de dependencias
```

---

## 🌐 Endpoints Útiles

*   **UI Dashboard**: `http://localhost:3000`
*   **Health Check**: `http://localhost:8090/health`
*   **API Local**: `http://localhost:8090`

---
*Desarrollado con ❤️ para un control total de tus medios.*
