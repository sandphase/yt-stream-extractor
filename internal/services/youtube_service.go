package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	analyzeArgs := []string{"-J", "--no-warnings", "--skip-download", "--no-playlist"}
	if nodePath, err := exec.LookPath("node"); err == nil && nodePath != "" {
		analyzeArgs = append(analyzeArgs, "--js-runtimes", fmt.Sprintf("node:%s", nodePath))
	}
	if cookieArgs := s.getCookiesArgs(); len(cookieArgs) > 0 {
		analyzeArgs = append(analyzeArgs, cookieArgs...)
	}
	analyzeArgs = append(analyzeArgs, url)

	cmd := exec.CommandContext(ctx, s.binPath, analyzeArgs...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		errStr := strings.TrimSpace(stderr.String())
		if errStr != "" {
			return models.AnalyzeResponse{}, fmt.Errorf("yt-dlp analyze failed: %s", errStr)
		}
		return models.AnalyzeResponse{}, fmt.Errorf("yt-dlp analyze failed: %w", err)
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

func (s *YouTubeService) BuildDownloadArgs(rec models.DownloadRecord, outDir string) []string {
	outputTemplate := filepath.Join(outDir, "%(title)s-%(id)s.%(ext)s")
	args := []string{
		"--newline",
		"--no-warnings",
		"--continue",
		"--no-playlist",
		"-o", outputTemplate,
	}

	if nodePath, err := exec.LookPath("node"); err == nil && nodePath != "" {
		args = append(args, "--js-runtimes", fmt.Sprintf("node:%s", nodePath))
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
