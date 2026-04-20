package services

import (
	"os"
	"path/filepath"
	"strings"
)

// CleanupPartialDownloads elimina fragmentos típicos de yt-dlp/ffmpeg tras cancelar o error.
func CleanupPartialDownloads(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		lower := strings.ToLower(name)
		remove := strings.HasSuffix(lower, ".part") ||
			strings.HasSuffix(lower, ".ytdl") ||
			strings.HasSuffix(lower, ".temp") ||
			strings.Contains(lower, ".part-") ||
			strings.HasSuffix(lower, ".download") ||
			strings.HasSuffix(lower, ".frag")
		if remove {
			_ = os.Remove(filepath.Join(dir, name))
		}
	}
}
