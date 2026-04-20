package config

import (
	"os"
	"path/filepath"
	"runtime"
)

type Config struct {
	Address      string
	DatabasePath string
	DownloadDir  string
	YTDLPPath    string
	FFmpegPath   string
}

func Load() Config {
	toolsDir := filepath.Join(".", "tools", "bin")
	yt := "yt-dlp"
	ffmpeg := "ffmpeg"
	if runtime.GOOS == "windows" {
		yt = "yt-dlp.exe"
		ffmpeg = "ffmpeg.exe"
	}

	return Config{
		Address:      env("YT_ADDRESS", "127.0.0.1:8090"),
		DatabasePath: env("YT_DB_PATH", "./data/ytdown.db"),
		DownloadDir:  env("YT_DOWNLOAD_DIR", "./downloads"),
		YTDLPPath:    env("YT_DLP_PATH", filepath.Join(toolsDir, yt)),
		FFmpegPath:   env("YT_FFMPEG_PATH", filepath.Join(toolsDir, ffmpeg)),
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
