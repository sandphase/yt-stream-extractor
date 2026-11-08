package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"ytdown/internal/models"
)

var invidiousInstances = []string{
	"https://yt.chocolatemoo53.com",
}

const browserUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

type invidiousVideoResponse struct {
	Title            string                `json:"title"`
	VideoID          string                `json:"videoId"`
	LengthSeconds    int                   `json:"lengthSeconds"`
	ViewCount        int64                 `json:"viewCount"`
	Author           string                `json:"author"`
	Genre            string                `json:"genre"`
	VideoThumbnails  []invidiousThumbnail  `json:"videoThumbnails"`
	AuthorThumbnails []invidiousThumbnail  `json:"authorThumbnails"`
	AdaptiveFormats  []invidiousFormatItem `json:"adaptiveFormats"`
	FormatStreams    []invidiousFormatItem `json:"formatStreams"`
}

type invidiousThumbnail struct {
	Quality string `json:"quality"`
	URL     string `json:"url"`
	Width   int    `json:"width"`
	Height  int    `json:"height"`
}

type invidiousFormatItem struct {
	Itag         string `json:"itag"`
	URL          string `json:"url"`
	Type         string `json:"type"`
	Container    string `json:"container"`
	Encoding     string `json:"encoding"`
	QualityLabel string `json:"qualityLabel"`
	Resolution   string `json:"resolution"`
	Bitrate      string `json:"bitrate"`
	Clen         string `json:"clen"`
	FPS          int    `json:"fps"`
}

func ExtractYouTubeID(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if idx := strings.Index(rawURL, "v="); idx != -1 {
		part := rawURL[idx+2:]
		for _, sep := range []string{"&", "#", "?"} {
			if sIdx := strings.Index(part, sep); sIdx != -1 {
				part = part[:sIdx]
			}
		}
		if len(part) >= 10 {
			return part
		}
	}
	for _, prefix := range []string{"youtu.be/", "/shorts/", "/embed/", "/v/"} {
		if idx := strings.Index(rawURL, prefix); idx != -1 {
			part := rawURL[idx+len(prefix):]
			for _, sep := range []string{"?", "&", "#", "/"} {
				if sIdx := strings.Index(part, sep); sIdx != -1 {
					part = part[:sIdx]
				}
			}
			if len(part) >= 10 {
				return part
			}
		}
	}
	return ""
}

func fetchInvidiousMetadata(ctx context.Context, videoID string) (*invidiousVideoResponse, error) {
	if videoID == "" {
		return nil, fmt.Errorf("no valid YouTube video ID found")
	}

	client := &http.Client{Timeout: 10 * time.Second}
	var lastErr error

	for _, base := range invidiousInstances {
		apiURL := fmt.Sprintf("%s/api/v1/videos/%s?local=true", strings.TrimRight(base, "/"), videoID)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
		if err != nil {
			lastErr = err
			continue
		}
		req.Header.Set("User-Agent", browserUserAgent)
		req.Header.Set("Accept", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		body, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusOK || readErr != nil {
			lastErr = fmt.Errorf("invidious HTTP %d", resp.StatusCode)
			continue
		}

		var parsed invidiousVideoResponse
		if err := json.Unmarshal(body, &parsed); err != nil {
			lastErr = err
			continue
		}
		if parsed.Title == "" || (len(parsed.AdaptiveFormats) == 0 && len(parsed.FormatStreams) == 0) {
			lastErr = fmt.Errorf("empty formats in invidious response")
			continue
		}
		return &parsed, nil
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("no invidious instances available")
	}
	return nil, lastErr
}

func parseHeightStr(res string) float64 {
	res = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(res)), "p")
	if v, err := strconv.ParseFloat(res, 64); err == nil && v > 0 {
		return v
	}
	return 0
}

func (s *YouTubeService) AnalyzeViaInvidious(rawURL string) (models.AnalyzeResponse, error) {
	videoID := ExtractYouTubeID(rawURL)
	if videoID == "" {
		return models.AnalyzeResponse{}, fmt.Errorf("not a youtube video id")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()

	meta, err := fetchInvidiousMetadata(ctx, videoID)
	if err != nil {
		return models.AnalyzeResponse{}, err
	}

	rawFormats := make([]rawYtdlpFormat, 0, len(meta.AdaptiveFormats))
	for _, f := range meta.AdaptiveFormats {
		br, _ := strconv.ParseFloat(f.Bitrate, 64)
		clen, _ := strconv.ParseFloat(f.Clen, 64)
		kbps := br / 1000.0
		h := parseHeightStr(f.Resolution)
		if h == 0 {
			h = parseHeightStr(f.QualityLabel)
		}

		rf := rawYtdlpFormat{
			FormatID:   f.Itag,
			FormatNote: f.QualityLabel,
			Height:     h,
			Fps:        float64(f.FPS),
			Tbr:        kbps,
			Filesize:   clen,
		}

		lowType := strings.ToLower(f.Type)
		if strings.HasPrefix(lowType, "video/") {
			vc := f.Encoding
			if vc == "" {
				vc = "avc1"
			}
			rf.Vcodec = vc
			rf.Acodec = "none"
		} else if strings.HasPrefix(lowType, "audio/") {
			ac := f.Encoding
			if ac == "" {
				ac = "mp4a"
			}
			rf.Vcodec = "none"
			rf.Acodec = ac
			rf.Abr = kbps
		}
		rawFormats = append(rawFormats, rf)
	}

	videoChoices, audioChoices := BuildFormatChoices(rawFormats)

	thumb := fmt.Sprintf("https://i.ytimg.com/vi/%s/hqdefault.jpg", videoID)

	chThumb := ""
	bestChArea := 0
	for _, t := range meta.AuthorThumbnails {
		if t.URL != "" && strings.HasPrefix(t.URL, "http") {
			area := t.Width * t.Height
			if area >= bestChArea {
				bestChArea = area
				chThumb = t.URL
			}
		}
	}

	var cats []string
	if meta.Genre != "" {
		cats = []string{meta.Genre}
	}

	dur := meta.LengthSeconds
	if dur < 0 {
		dur = 0
	}

	return models.AnalyzeResponse{
		Title:             strings.TrimSpace(meta.Title),
		Thumbnail:         thumb,
		ChannelThumbnail:  chThumb,
		Duration:          dur,
		DurationFormatted: formatDurationHMS(dur),
		Uploader:          meta.Author,
		ViewCount:         meta.ViewCount,
		Categories:        cats,
		VideoFormats:      videoChoices,
		AudioFormats:      audioChoices,
	}, nil
}

func downloadStreamFile(ctx context.Context, streamURL string, destFile string, pctStart int, pctEnd int, label string, onProgress func(pct int, msg string, spd float64, eta string)) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, streamURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", browserUserAgent)

	client := &http.Client{Timeout: 15 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		return fmt.Errorf("stream HTTP %d", resp.StatusCode)
	}

	totalBytes := resp.ContentLength
	out, err := os.Create(destFile)
	if err != nil {
		return err
	}
	defer out.Close()

	buf := make([]byte, 64*1024)
	var downloaded int64
	startTime := time.Now()
	lastReport := time.Now().Add(-1 * time.Second)

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, wErr := out.Write(buf[:n]); wErr != nil {
				return wErr
			}
			downloaded += int64(n)

			if time.Since(lastReport) >= 250*time.Millisecond {
				lastReport = time.Now()
				elapsed := time.Since(startTime).Seconds()
				var spdMiB float64
				if elapsed > 0.1 {
					spdMiB = (float64(downloaded) / (1024.0 * 1024.0)) / elapsed
				}
				pct := pctStart
				etaStr := "00:02"
				if totalBytes > 0 {
					ratio := float64(downloaded) / float64(totalBytes)
					if ratio > 1 {
						ratio = 1
					}
					pct = pctStart + int(ratio*float64(pctEnd-pctStart))
					remBytes := totalBytes - downloaded
					if spdMiB > 0.05 && remBytes > 0 {
						remSec := int((float64(remBytes) / (1024.0 * 1024.0)) / spdMiB)
						etaStr = fmt.Sprintf("%02d:%02d", remSec/60, remSec%60)
					} else {
						etaStr = "00:00"
					}
				}
				dlMiB := float64(downloaded) / (1024.0 * 1024.0)
				totMiB := float64(totalBytes) / (1024.0 * 1024.0)
				msg := fmt.Sprintf("[download] %s: %.1f MiB / %.1f MiB (%.2f MiB/s)", label, dlMiB, totMiB, spdMiB)
				onProgress(pct, msg, spdMiB, etaStr)
			}
		}
		if readErr != nil {
			if readErr == io.EOF {
				break
			}
			return readErr
		}
	}
	return nil
}

func sanitizeFileTitle(title string) string {
	replacer := strings.NewReplacer(
		"/", " - ",
		"\\", " - ",
		":", " - ",
		"*", "",
		"?", "",
		"\"", "'",
		"<", "",
		">", "",
		"|", " - ",
	)
	s := strings.TrimSpace(replacer.Replace(title))
	if s == "" {
		return "YouTube_Stream"
	}
	return s
}

func (s *YouTubeService) DownloadViaInvidious(rec models.DownloadRecord, outDir string, isCanceled func() bool, onProgress func(pct int, msg string, spd float64, eta string)) (string, string, error) {
	videoID := ExtractYouTubeID(rec.URL)
	if videoID == "" {
		return "", "", fmt.Errorf("invalid youtube video ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()

	onProgress(8, "Conectando al motor de extracción de alta velocidad...", 0, "")
	meta, err := fetchInvidiousMetadata(ctx, videoID)
	if err != nil {
		return "", "", err
	}
	if isCanceled() {
		return "", "", fmt.Errorf("canceled")
	}

	cleanTitle := sanitizeFileTitle(meta.Title)
	container := strings.ToLower(strings.TrimSpace(rec.Container))
	mode := strings.ToLower(strings.TrimSpace(rec.Format))

	// Find best audio format
	var chosenAudio *invidiousFormatItem
	var bestAudioBitrate int
	for i := range meta.AdaptiveFormats {
		f := &meta.AdaptiveFormats[i]
		if !strings.HasPrefix(strings.ToLower(f.Type), "audio/") || f.URL == "" {
			continue
		}
		if mode == "audio" && rec.YTFormatID != "" && f.Itag == rec.YTFormatID {
			chosenAudio = f
			break
		}
		br, _ := strconv.Atoi(f.Bitrate)
		// Prefer m4a (itag 140) for fast compatibility, or highest bitrate
		if strings.Contains(strings.ToLower(f.Container), "m4a") {
			br += 20000
		}
		if br > bestAudioBitrate {
			bestAudioBitrate = br
			chosenAudio = f
		}
	}

	if chosenAudio == nil {
		return "", "", fmt.Errorf("no audio stream available from invidious")
	}

	ffmpegPath := "ffmpeg"
	if p, err := exec.LookPath("ffmpeg"); err == nil && p != "" {
		ffmpegPath = p
	}

	if mode == "audio" {
		if container == "" {
			container = "mp3"
		}
		tmpAudio := filepath.Join(outDir, fmt.Sprintf(".tmp_%s_%d.m4a", videoID, time.Now().UnixNano()))
		defer os.Remove(tmpAudio)

		if err := downloadStreamFile(ctx, chosenAudio.URL, tmpAudio, 10, 88, "Audio Stream", func(pct int, msg string, spd float64, eta string) {
			if isCanceled() {
				cancel()
			}
			onProgress(pct, msg, spd, eta)
		}); err != nil {
			return "", "", err
		}

		if isCanceled() {
			return "", "", fmt.Errorf("canceled")
		}

		finalPath := filepath.Join(outDir, fmt.Sprintf("%s-%s.%s", cleanTitle, videoID, container))
		onProgress(92, fmt.Sprintf("[Merger] Masterizando audio a %s...", strings.ToUpper(container)), 0, "00:01")

		ffArgs := []string{"-y"}
		if rec.ClipStart != "" {
			ffArgs = append(ffArgs, "-ss", rec.ClipStart)
		}
		if rec.ClipEnd != "" {
			ffArgs = append(ffArgs, "-to", rec.ClipEnd)
		}
		ffArgs = append(ffArgs, "-i", tmpAudio, "-vn")

		switch container {
		case "mp3":
			ffArgs = append(ffArgs, "-c:a", "libmp3lame", "-q:a", "0")
		case "m4a", "aac":
			if rec.ClipStart == "" && rec.ClipEnd == "" && strings.Contains(strings.ToLower(chosenAudio.Container), "m4a") {
				ffArgs = append(ffArgs, "-c:a", "copy")
			} else {
				ffArgs = append(ffArgs, "-c:a", "aac", "-b:a", "256k")
			}
		case "wav":
			ffArgs = append(ffArgs, "-c:a", "pcm_s16le")
		case "flac":
			ffArgs = append(ffArgs, "-c:a", "flac")
		case "opus":
			ffArgs = append(ffArgs, "-c:a", "libopus", "-b:a", "192k")
		default:
			ffArgs = append(ffArgs, "-c:a", "libmp3lame", "-q:a", "2")
		}
		ffArgs = append(ffArgs, finalPath)

		cmd := exec.CommandContext(ctx, ffmpegPath, ffArgs...)
		if out, err := cmd.CombinedOutput(); err != nil {
			return "", "", fmt.Errorf("ffmpeg audio conversion failed: %v (%s)", err, string(out))
		}

		return finalPath, meta.Title, nil
	}

	// Video Mode
	if container == "" {
		container = "mp4"
	}
	targetHeight := 1080
	if rec.Quality != "" && rec.Quality != "best" {
		if h, err := strconv.Atoi(strings.TrimSuffix(rec.Quality, "p")); err == nil && h > 0 {
			targetHeight = h
		}
	}

	var chosenVideo *invidiousFormatItem
	var bestVideoScore int
	for i := range meta.AdaptiveFormats {
		f := &meta.AdaptiveFormats[i]
		if !strings.HasPrefix(strings.ToLower(f.Type), "video/") || f.URL == "" {
			continue
		}
		if rec.YTFormatID != "" && f.Itag == rec.YTFormatID {
			chosenVideo = f
			break
		}
		h := int(parseHeightStr(f.Resolution))
		if h == 0 {
			h = int(parseHeightStr(f.QualityLabel))
		}
		if h > targetHeight {
			continue
		}
		score := h * 100
		if strings.Contains(strings.ToLower(f.Type), "avc1") {
			score += 50
		} else if strings.Contains(strings.ToLower(f.Container), "mp4") {
			score += 25
		}
		if score > bestVideoScore {
			bestVideoScore = score
			chosenVideo = f
		}
	}

	if chosenVideo == nil {
		// Fallback to any video stream
		for i := range meta.AdaptiveFormats {
			f := &meta.AdaptiveFormats[i]
			if strings.HasPrefix(strings.ToLower(f.Type), "video/") && f.URL != "" {
				chosenVideo = f
				break
			}
		}
	}
	if chosenVideo == nil {
		return "", "", fmt.Errorf("no video stream available from invidious")
	}

	tmpVideo := filepath.Join(outDir, fmt.Sprintf(".tmp_v_%s_%d.mp4", videoID, time.Now().UnixNano()))
	tmpAudio := filepath.Join(outDir, fmt.Sprintf(".tmp_a_%s_%d.m4a", videoID, time.Now().UnixNano()))
	defer os.Remove(tmpVideo)
	defer os.Remove(tmpAudio)

	if err := downloadStreamFile(ctx, chosenVideo.URL, tmpVideo, 8, 72, "Video Stream", func(pct int, msg string, spd float64, eta string) {
		if isCanceled() {
			cancel()
		}
		onProgress(pct, msg, spd, eta)
	}); err != nil {
		return "", "", err
	}

	if isCanceled() {
		return "", "", fmt.Errorf("canceled")
	}

	if err := downloadStreamFile(ctx, chosenAudio.URL, tmpAudio, 72, 92, "Audio Stream", func(pct int, msg string, spd float64, eta string) {
		if isCanceled() {
			cancel()
		}
		onProgress(pct, msg, spd, eta)
	}); err != nil {
		return "", "", err
	}

	if isCanceled() {
		return "", "", fmt.Errorf("canceled")
	}

	finalPath := filepath.Join(outDir, fmt.Sprintf("%s-%s.%s", cleanTitle, videoID, container))
	onProgress(95, fmt.Sprintf("[Merger] Uniendo pistas de video y audio en %s...", strings.ToUpper(container)), 0, "00:01")

	ffArgs := []string{"-y"}
	if rec.ClipStart != "" {
		ffArgs = append(ffArgs, "-ss", rec.ClipStart)
	}
	if rec.ClipEnd != "" {
		ffArgs = append(ffArgs, "-to", rec.ClipEnd)
	}
	ffArgs = append(ffArgs, "-i", tmpVideo)
	if rec.ClipStart != "" {
		ffArgs = append(ffArgs, "-ss", rec.ClipStart)
	}
	if rec.ClipEnd != "" {
		ffArgs = append(ffArgs, "-to", rec.ClipEnd)
	}
	ffArgs = append(ffArgs, "-i", tmpAudio, "-c:v", "copy", "-c:a", "aac", "-shortest", finalPath)

	cmd := exec.CommandContext(ctx, ffmpegPath, ffArgs...)
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", "", fmt.Errorf("ffmpeg video muxing failed: %v (%s)", err, string(out))
	}

	return finalPath, meta.Title, nil
}
