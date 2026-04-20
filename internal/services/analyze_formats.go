package services

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"

	"ytdown/internal/models"
)

type rawYtdlpFormat struct {
	FormatID   string  `json:"format_id"`
	FormatNote string  `json:"format_note"`
	Height     float64 `json:"height"`
	Fps        float64 `json:"fps"`
	Vcodec     string  `json:"vcodec"`
	Acodec     string  `json:"acodec"`
	Abr        float64 `json:"abr"`
	Tbr        float64 `json:"tbr"`
	Filesize   float64 `json:"filesize"`
}

type ytdlpDump struct {
	Title             string            `json:"title"`
	Thumbnail         string            `json:"thumbnail"`
	Duration          float64           `json:"duration"`
	Uploader          string            `json:"uploader"`
	ViewCount         float64           `json:"view_count"`
	Categories        []string          `json:"categories"`
	Formats           []json.RawMessage `json:"formats"`
	Thumbnails        []thumbnailEntry  `json:"thumbnails"`
	UploaderThumbnail string            `json:"uploader_thumbnail"`
}

type thumbnailEntry struct {
	URL    string `json:"url"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

func pickChannelThumb(dump *ytdlpDump) string {
	if strings.TrimSpace(dump.UploaderThumbnail) != "" {
		return dump.UploaderThumbnail
	}
	var best string
	var bestArea int
	for _, t := range dump.Thumbnails {
		if t.URL == "" {
			continue
		}
		if strings.Contains(t.URL, "yt3") || strings.Contains(t.URL, "ggpht") {
			area := t.Width * t.Height
			if area >= bestArea {
				bestArea = area
				best = t.URL
			}
		}
	}
	return best
}

func formatDurationHMS(seconds int) string {
	if seconds < 0 {
		seconds = 0
	}
	h := seconds / 3600
	m := (seconds % 3600) / 60
	s := seconds % 60
	return fmt.Sprintf("%02d:%02d:%02d", h, m, s)
}

func parseRawFormats(raw []json.RawMessage) ([]rawYtdlpFormat, error) {
	out := make([]rawYtdlpFormat, 0, len(raw))
	for _, r := range raw {
		var f rawYtdlpFormat
		if err := json.Unmarshal(r, &f); err != nil {
			continue
		}
		out = append(out, f)
	}
	return out, nil
}

func vcodecOK(v string) bool {
	v = strings.TrimSpace(strings.ToLower(v))
	return v != "" && v != "none"
}

func acodecOK(a string) bool {
	a = strings.TrimSpace(strings.ToLower(a))
	return a != "" && a != "none"
}

type vfKey struct {
	H   int
	FPS int
}

type vidCand struct {
	f      rawYtdlpFormat
	score  float64
	height int
	fpsi   int
}

func scoreFmt(f rawYtdlpFormat) float64 {
	t := f.Tbr
	if t <= 0 {
		t = f.Abr
	}
	if t <= 0 {
		t = float64(f.Height) * 10
	}
	return t
}

// BuildFormatChoices construye opciones de vídeo y audio a partir del array formats de yt-dlp -J.
func BuildFormatChoices(formats []rawYtdlpFormat) (video []models.FormatChoice, audio []models.FormatChoice) {
	var progressive, videoOnly, audioOnly []rawYtdlpFormat

	for _, f := range formats {
		vc, ac := f.Vcodec, f.Acodec
		h := int(f.Height)
		if h < 0 {
			h = 0
		}
		prog := vcodecOK(vc) && acodecOK(ac)
		vOnly := vcodecOK(vc) && !acodecOK(ac)
		aOnly := !vcodecOK(vc) && acodecOK(ac)

		if prog && h > 0 {
			progressive = append(progressive, f)
			continue
		}
		if vOnly && h > 0 {
			videoOnly = append(videoOnly, f)
		}
		if aOnly {
			audioOnly = append(audioOnly, f)
		}
	}

	bestAudioID := ""
	bestAudioScore := -1.0
	for _, f := range audioOnly {
		sc := f.Abr
		if sc <= 0 {
			sc = f.Tbr
		}
		if sc > bestAudioScore && f.FormatID != "" {
			bestAudioScore = sc
			bestAudioID = f.FormatID
		}
	}

	byKey := make(map[vfKey][]vidCand)

	for _, f := range progressive {
		h := int(f.Height)
		if h <= 0 {
			continue
		}
		fpsi := int(math.Round(f.Fps))
		if fpsi <= 0 {
			fpsi = 30
		}
		k := vfKey{H: h, FPS: fpsi}
		byKey[k] = append(byKey[k], vidCand{f: f, score: scoreFmt(f), height: h, fpsi: fpsi})
	}

	if len(byKey) == 0 && len(videoOnly) > 0 {
		for _, f := range videoOnly {
			h := int(f.Height)
			if h <= 0 {
				continue
			}
			fpsi := int(math.Round(f.Fps))
			if fpsi <= 0 {
				fpsi = 30
			}
			k := vfKey{H: h, FPS: fpsi}
			byKey[k] = append(byKey[k], vidCand{f: f, score: scoreFmt(f), height: h, fpsi: fpsi})
		}
	}

	keys := make([]vfKey, 0, len(byKey))
	for k := range byKey {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].H != keys[j].H {
			return keys[i].H > keys[j].H
		}
		return keys[i].FPS > keys[j].FPS
	})

	for _, k := range keys {
		cands := byKey[k]
		sort.Slice(cands, func(i, j int) bool { return cands[i].score > cands[j].score })
		best := cands[0].f
		h := cands[0].height
		fps := best.Fps
		if fps <= 0 {
			fps = float64(cands[0].fpsi)
		}

		label := fmt.Sprintf("%dp", h)
		if cands[0].fpsi >= 50 {
			label = fmt.Sprintf("%dp%dfps", h, cands[0].fpsi)
		} else if math.Abs(fps-30) > 2 && math.Abs(fps-24) > 2 && math.Abs(fps-25) > 2 {
			label = fmt.Sprintf("%dp%.0ffps", h, fps)
		}

		combo := best.FormatID
		mux := vcodecOK(best.Vcodec) && acodecOK(best.Acodec)
		if !mux && bestAudioID != "" {
			combo = best.FormatID + "+" + bestAudioID
		}

		video = append(video, models.FormatChoice{
			ID:     combo,
			Label:  label,
			Height: h,
			FPS:    fps,
			Kind:   "video",
		})
	}

	abrBuckets := map[int]string{}
	for _, f := range audioOnly {
		abr := int(math.Round(f.Abr))
		if abr <= 0 {
			abr = int(math.Round(f.Tbr))
		}
		if abr <= 0 || f.FormatID == "" {
			continue
		}
		bucket := abr
		for _, b := range []int{320, 256, 192, 160, 128, 96, 64} {
			if abr >= b-12 {
				bucket = b
				break
			}
		}
		if _, ok := abrBuckets[bucket]; !ok {
			abrBuckets[bucket] = f.FormatID
		}
	}
	for _, b := range []int{320, 256, 192, 160, 128, 96, 64} {
		if id, ok := abrBuckets[b]; ok {
			audio = append(audio, models.FormatChoice{
				ID:          id,
				Label:       fmt.Sprintf("~%d kbps", b),
				BitrateKbps: b,
				Kind:        "audio",
			})
		}
	}
	sort.Slice(audio, func(i, j int) bool { return audio[i].BitrateKbps > audio[j].BitrateKbps })

	if len(video) == 0 {
		video = []models.FormatChoice{{
			ID:    "bv*+ba/best",
			Label: "Mejor calidad (automático)",
			Kind:  "video",
		}}
	}
	if len(audio) == 0 {
		audio = []models.FormatChoice{{
			ID:    "bestaudio/best",
			Label: "Mejor audio disponible",
			Kind:  "audio",
		}}
	}

	return video, audio
}
