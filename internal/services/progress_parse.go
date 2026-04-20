package services

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	reDownloadPct  = regexp.MustCompile(`(\d+(?:\.\d+)?)\s*%`)
	reDownloadSpd  = regexp.MustCompile(`at\s+(\d+(?:\.\d+)?)\s*(KiB|MiB|GiB|KB|MB|GB)/s`)
	reDownloadETA  = regexp.MustCompile(`ETA\s+(\d{1,3}:\d{2}(?::\d{2})?)`)
)

// ParseYtDlpProgressLine extrae porcentaje, velocidad aproximada en MiB/s y texto ETA de líneas estándar de yt-dlp.
func ParseYtDlpProgressLine(line string) (pct int, hasPct bool, speedMiB float64, eta string) {
	if m := reDownloadPct.FindStringSubmatch(line); len(m) > 1 {
		if v, err := strconv.ParseFloat(m[1], 64); err == nil {
			pct = int(v + 0.5)
			if pct > 100 {
				pct = 100
			}
			hasPct = true
		}
	}
	if m := reDownloadSpd.FindStringSubmatch(line); len(m) > 2 {
		val, err1 := strconv.ParseFloat(m[1], 64)
		if err1 == nil {
			switch m[2] {
			case "KiB", "KB":
				speedMiB = val / 1024
			case "MiB", "MB":
				speedMiB = val
			case "GiB", "GB":
				speedMiB = val * 1024
			}
		}
	}
	if m := reDownloadETA.FindStringSubmatch(line); len(m) > 1 {
		eta = strings.TrimSpace(m[1])
	}
	return pct, hasPct, speedMiB, eta
}
