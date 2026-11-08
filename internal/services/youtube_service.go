package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"ytdown/internal/models"
)

type YouTubeService struct {
	binPath string
}

func NewYouTubeService(path string) *YouTubeService {
	return &YouTubeService{binPath: path}
}

func IsSocksProxyAvailable() bool {
	conn, err := net.DialTimeout("tcp", "127.0.0.1:9050", 250*time.Millisecond)
	if err == nil {
		_ = conn.Close()
		return true
	}
	return false
}

func IsAntibotOrLoginError(errStr string) bool {
	low := strings.ToLower(errStr)
	return strings.Contains(low, "sign in") ||
		strings.Contains(low, "login_required") ||
		strings.Contains(low, "bot") ||
		strings.Contains(low, "confirm you’re not a bot") ||
		strings.Contains(low, "confirm you're not a bot") ||
		strings.Contains(low, "please sign in") ||
		strings.Contains(low, "confirm your age") ||
		strings.Contains(low, "blocked")
}

func (s *YouTubeService) getProxyArgs() []string {
	if envProxy := strings.TrimSpace(os.Getenv("YT_PROXY")); envProxy != "" {
		return []string{"--proxy", envProxy}
	}
	if IsSocksProxyAvailable() {
		return []string{"--proxy", "socks5://127.0.0.1:9050"}
	}
	return nil
}

func (s *YouTubeService) getCookiesArgs() []string {
	candidates := []string{
		"./data/cookies.txt",
		"./cookies.txt",
		"/var/www/nullphasedev/apps/yt-stream-extractor/data/cookies.txt",
		"/var/www/nullphasedev/apps/yt-stream-extractor/cookies.txt",
	}
	if envPath := strings.TrimSpace(os.Getenv("YT_COOKIES_PATH")); envPath != "" {
		candidates = append([]string{envPath}, candidates...)
	}
	for _, p := range candidates {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() && fi.Size() > 0 {
			return []string{"--cookies", p}
		}
	}
	return nil
}

func (s *YouTubeService) Analyze(url string) (models.AnalyzeResponse, error) {
	// 0. Motor primario de alta velocidad (Invidious Stream Engine, ~1.2s, sin bloqueos antibot/edad)
	if invResp, invErr := s.AnalyzeViaInvidious(url); invErr == nil && invResp.Title != "" {
		return invResp, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	runYtDlp := func(useCookies bool, useProxy bool) ([]byte, error) {
		analyzeArgs := []string{"-J", "--no-warnings", "--skip-download", "--no-playlist"}
		if denoPath, err := exec.LookPath("deno"); err == nil && denoPath != "" {
			analyzeArgs = append(analyzeArgs, "--js-runtimes", fmt.Sprintf("deno:%s", denoPath))
		} else if nodePath, err := exec.LookPath("node"); err == nil && nodePath != "" {
			analyzeArgs = append(analyzeArgs, "--js-runtimes", fmt.Sprintf("node:%s", nodePath))
		}
		analyzeArgs = append(analyzeArgs, "--extractor-args", "youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416")

		if useProxy {
			if proxyArgs := s.getProxyArgs(); len(proxyArgs) > 0 {
				analyzeArgs = append(analyzeArgs, proxyArgs...)
			}
		}
		if useCookies {
			if cookieArgs := s.getCookiesArgs(); len(cookieArgs) > 0 {
				analyzeArgs = append(analyzeArgs, cookieArgs...)
			}
		}
		analyzeArgs = append(analyzeArgs, url)

		cmd := exec.CommandContext(ctx, s.binPath, analyzeArgs...)
		var stderr bytes.Buffer
		cmd.Stderr = &stderr
		out, err := cmd.Output()
		if err != nil {
			errStr := strings.TrimSpace(stderr.String())
			if errStr != "" {
				return nil, fmt.Errorf("%s", errStr)
			}
			return nil, err
		}
		return out, nil
	}

	// 1. Intentar con el túnel SOCKS5 si está disponible (evita bloqueo de IP de datacenter)
	var out []byte
	var err error
	if IsSocksProxyAvailable() {
		out, err = runYtDlp(false, true)
		if err != nil {
			if directOut, directErr := runYtDlp(false, false); directErr == nil {
				out = directOut
				err = nil
			}
		}
	} else {
		out, err = runYtDlp(false, false)
	}

	// 2. Si aún falla por autenticación o restricción, intentar con cookies.txt si existe
	if err != nil && IsAntibotOrLoginError(err.Error()) {
		if cookieOut, cookieErr := runYtDlp(true, false); cookieErr == nil {
			out = cookieOut
			err = nil
		} else if IsSocksProxyAvailable() {
			if cpOut, cpErr := runYtDlp(true, true); cpErr == nil {
				out = cpOut
				err = nil
			}
		}
	}

	if err != nil {
		return models.AnalyzeResponse{}, fmt.Errorf("No se pudo analizar este enlace. Asegúrate de que sea un video público válido de YouTube.")
	}

	var dump ytdlpDump
	if err := json.Unmarshal(out, &dump); err != nil {
		return models.AnalyzeResponse{}, fmt.Errorf("decode metadata: %w", err)
	}

	rawFormats, err := parseRawFormats(dump.Formats)
	if err != nil {
		rawFormats = nil
	}
	videoChoices, audioChoices := BuildFormatChoices(rawFormats)

	dur := int(dump.Duration)
	if dur < 0 {
		dur = 0
	}

	chThumb := pickChannelThumb(&dump)

	return models.AnalyzeResponse{
		Title:             strings.TrimSpace(dump.Title),
		Thumbnail:         dump.Thumbnail,
		ChannelThumbnail:  chThumb,
		Duration:          dur,
		DurationFormatted: formatDurationHMS(dur),
		Uploader:          dump.Uploader,
		ViewCount:         int64(dump.ViewCount),
		Categories:        dump.Categories,
		VideoFormats:      videoChoices,
		AudioFormats:      audioChoices,
	}, nil
}

func (s *YouTubeService) BuildDownloadArgs(rec models.DownloadRecord, outDir string, useProxy bool) []string {
	outputTemplate := filepath.Join(outDir, "%(title)s-%(id)s.%(ext)s")
	args := []string{
		"--newline",
		"--no-warnings",
		"--continue",
		"--no-playlist",
		"-o", outputTemplate,
	}

	if denoPath, err := exec.LookPath("deno"); err == nil && denoPath != "" {
		args = append(args, "--js-runtimes", fmt.Sprintf("deno:%s", denoPath))
	} else if nodePath, err := exec.LookPath("node"); err == nil && nodePath != "" {
		args = append(args, "--js-runtimes", fmt.Sprintf("node:%s", nodePath))
	}
	args = append(args, "--extractor-args", "youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416")

	if useProxy {
		if proxyArgs := s.getProxyArgs(); len(proxyArgs) > 0 {
			args = append(args, proxyArgs...)
		}
	}
	if cookieArgs := s.getCookiesArgs(); len(cookieArgs) > 0 {
		args = append(args, cookieArgs...)
	}
	if ffmpegPath, err := exec.LookPath("ffmpeg"); err == nil && ffmpegPath != "" {
		args = append(args, "--ffmpeg-location", ffmpegPath)
	}

	if rec.AddMetadata {
		args = append(args, "--embed-thumbnail", "--embed-metadata", "--add-metadata")
	}

	if rec.ClipStart != "" || rec.ClipEnd != "" {
		section := fmt.Sprintf("*%s-%s", rec.ClipStart, rec.ClipEnd)
		args = append(args, "--download-sections", section)
	}

	container := strings.ToLower(rec.Container)

	switch strings.ToLower(rec.Format) {
	case "audio":
		if container == "" {
			container = "mp3"
		}
		if strings.TrimSpace(rec.YTFormatID) != "" {
			args = append(args, "-f", rec.YTFormatID)
		} else {
			args = append(args, "-f", "bestaudio/best")
		}
		args = append(args, "-x", "--audio-format", container, "--audio-quality", "0")
	case "video":
		fsel := strings.TrimSpace(rec.YTFormatID)
		if fsel == "" {
			if rec.Quality != "" && rec.Quality != "best" {
				fsel = fmt.Sprintf("bv*[height<=%s]+ba/b[height<=%s]/best", rec.Quality, rec.Quality)
			} else {
				fsel = "bv*+ba/best"
			}
		}
		args = append(args, "-f", fsel)
		if container != "" {
			args = append(args, "--merge-output-format", container)
		}
	default:
		args = append(args, "-f", "best")
	}

	args = append(args, rec.URL)
	return args
}
