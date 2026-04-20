package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"ytdown/internal/config"
	"ytdown/internal/models"
	"ytdown/internal/repository"
	"ytdown/internal/services"
)

type Handler struct {
	repo       *repository.DownloadRepository
	jobs       *services.JobManager
	youtube    *services.YouTubeService
	wsHub      *services.WebsocketHub
	config     config.Config
	publicPath string
}

func NewHandler(repo *repository.DownloadRepository, jobs *services.JobManager, youtube *services.YouTubeService, wsHub *services.WebsocketHub, cfg config.Config) *Handler {
	return &Handler{
		repo:       repo,
		jobs:       jobs,
		youtube:    youtube,
		wsHub:      wsHub,
		config:     cfg,
		publicPath: "./web",
	}
}

func (h *Handler) Analyze(w http.ResponseWriter, r *http.Request) {
	type request struct {
		URL string `json:"url"`
	}

	var body request
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.URL) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid URL"})
		return
	}

	data, err := h.youtube.Analyze(body.URL)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, data)
}

func (h *Handler) QueueDownload(w http.ResponseWriter, r *http.Request) {
	var req models.DownloadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Malformed payload"})
		return
	}

	req.URL = strings.TrimSpace(req.URL)
	req.Format = strings.ToLower(strings.TrimSpace(req.Format))
	req.Container = strings.ToLower(strings.TrimSpace(req.Container))
	req.Quality = strings.ToLower(strings.TrimSpace(req.Quality))

	if req.URL == "" || (req.Format != "audio" && req.Format != "video") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Provide url and format (audio|video)"})
		return
	}
	if req.Quality == "" {
		req.Quality = "best"
	}

	record := &models.DownloadRecord{
		SourceURL:       req.URL,
		SourcePlatform:  detectPlatform(req.URL),
		URL:             req.URL,
		Format:          req.Format,
		Container:       req.Container,
		Quality:         req.Quality,
		YTFormatID:      strings.TrimSpace(req.YTFormatID),
		VideoFPS:        req.VideoFPS,
		AudioBitrate:    req.AudioBitrate,
		OutputDir:       strings.TrimSpace(req.OutputDir),
		ClipStart:       strings.TrimSpace(req.ClipStart),
		ClipEnd:         strings.TrimSpace(req.ClipEnd),
		AddMetadata:     req.AddMetadata,
		AISeparateStems: req.AISeparateStems,
		AITranscribe:    req.AITranscribe,
		AIGenerateBRoll: req.AIGenerateBRoll,
		Artist:          req.Artist,
		Album:           req.Album,
		Status:          "queued",
	}
	id, err := h.repo.Create(record)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	h.jobs.Enqueue(id)
	writeJSON(w, http.StatusAccepted, map[string]any{
		"id":      id,
		"status":  "queued",
		"message": "Download job created",
	})
}

func (h *Handler) QueueBatch(w http.ResponseWriter, r *http.Request) {
	var req models.BatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Malformed payload"})
		return
	}

	urls := make([]string, 0, len(req.URLs))
	for _, u := range req.URLs {
		u = strings.TrimSpace(u)
		if u != "" {
			urls = append(urls, u)
		}
	}
	for _, line := range strings.Split(req.RawText, "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			urls = append(urls, line)
		}
	}
	if len(urls) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "No URLs in batch"})
		return
	}

	ids := make([]int64, 0, len(urls))
	for _, url := range urls {
		record := &models.DownloadRecord{
			SourceURL:       url,
			SourcePlatform:  detectPlatform(url),
			URL:             url,
			Format:          firstNotEmpty(req.Format, "video"),
			Container:       req.Container,
			Quality:         firstNotEmpty(req.Quality, "best"),
			OutputDir:       req.OutputDir,
			ClipStart:       req.ClipStart,
			ClipEnd:         req.ClipEnd,
			AddMetadata:     req.Metadata,
			AISeparateStems: false, // Batch default
			AITranscribe:    false,
			AIGenerateBRoll: false,
			Artist:          req.Artist,
			Album:           req.Album,
			Status:          "queued",
		}
		id, err := h.repo.Create(record)
		if err != nil {
			continue
		}
		ids = append(ids, id)
		h.jobs.Enqueue(id)
	}

	writeJSON(w, http.StatusAccepted, map[string]any{"queued": len(ids), "ids": ids})
}

func (h *Handler) DownloadStatus(w http.ResponseWriter, r *http.Request) {
	idRaw := r.URL.Query().Get("id")
	id, err := strconv.ParseInt(idRaw, 10, 64)
	if err != nil || id <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid id"})
		return
	}
	writeJSON(w, http.StatusOK, h.jobs.Status(id))
}

func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.List(100)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *Handler) ControlJob(w http.ResponseWriter, r *http.Request) {
	type request struct {
		ID     int64  `json:"id"`
		Action string `json:"action"`
	}
	var body request
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
		return
	}
	action := strings.ToLower(strings.TrimSpace(body.Action))
	switch action {
	case "pause":
		h.jobs.Pause(body.ID)
	case "resume":
		h.jobs.Resume(body.ID)
	case "cancel":
		h.jobs.ForceCancel(body.ID)
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Action must be pause|resume|cancel"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": body.ID, "action": action})
}

// DeleteJob cancela un trabajo matando el proceso yt-dlp (PID) y limpiando fragmentos.
func (h *Handler) DeleteJob(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid job id"})
		return
	}
	h.jobs.ForceCancel(id)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id, "state": "canceled"})
}

func (h *Handler) ActiveJobs(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, h.jobs.ActiveJobs())
}

func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	totalStorage := int64(0)
	_ = filepath.Walk(h.config.DownloadDir, func(_ string, info os.FileInfo, err error) error {
		if err == nil && info != nil && !info.IsDir() {
			totalStorage += info.Size()
		}
		return nil
	})
	stats, err := h.repo.Stats(totalStorage)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (h *Handler) Websocket(w http.ResponseWriter, r *http.Request) {
	h.wsHub.Handle(w, r)
}

func (h *Handler) DeleteHistoryItem(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid id"})
		return
	}

	deleteFile := r.URL.Query().Get("deleteFile") == "true"
	if deleteFile {
		rec, err := h.repo.GetByID(id)
		if err == nil && rec.FilePath != "" {
			// Borrar archivo principal
			_ = os.Remove(rec.FilePath)
			// Borrar posibles archivos de IA coordinados
			base := strings.TrimSuffix(rec.FilePath, filepath.Ext(rec.FilePath))
			_ = os.Remove(base + ".txt")
			_ = os.Remove(base + "_resumen.txt")
		}
	}

	if err := h.repo.Delete(id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) ClearHistory(w http.ResponseWriter, r *http.Request) {
	// Por seguridad, ClearHistory masivo no borra archivos físicos a menos que lo forcemos,
	// pero en este caso solo limpia la DB según los requisitos estándar.
	if err := h.repo.DeleteAll(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) SetupInfo(w http.ResponseWriter, r *http.Request) {
	ytExists := fileExists(h.config.YTDLPPath)
	ffExists := fileExists(h.config.FFmpegPath)
	writeJSON(w, http.StatusOK, map[string]any{
		"ytdlpPath":    h.config.YTDLPPath,
		"ffmpegPath":   h.config.FFmpegPath,
		"ytdlpExists":  ytExists,
		"ffmpegExists": ffExists,
	})
}

func (h *Handler) GetAISummary(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
		return
	}

	record, err := h.repo.GetByID(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "record not found"})
		return
	}

	if record.FilePath == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "no file path for this record"})
		return
	}

	dir := filepath.Dir(record.FilePath)
	baseName := strings.TrimSuffix(filepath.Base(record.FilePath), filepath.Ext(record.FilePath))

	summaryPath := filepath.Join(dir, baseName+"_resumen.txt")
	transcriptPath := filepath.Join(dir, baseName+".txt")

	summary, errS := os.ReadFile(summaryPath)
	transcript, errT := os.ReadFile(transcriptPath)

	// Debug: Si no se encuentran, intentar búsqueda difusa en el handler también
	if errT != nil {
		files, _ := os.ReadDir(dir)
		searchPart := baseName
		if len(searchPart) > 10 {
			searchPart = searchPart[:10]
		}
		for _, f := range files {
			name := f.Name()
			if !f.IsDir() && strings.HasSuffix(name, ".txt") && !strings.Contains(name, "_resumen") {
				if strings.Contains(strings.ToLower(name), strings.ToLower(searchPart)) {
					transcript, _ = os.ReadFile(filepath.Join(dir, name))
					break
				}
			}
		}
	}
	if errS != nil {
		files, _ := os.ReadDir(dir)
		searchPart := baseName
		if len(searchPart) > 10 {
			searchPart = searchPart[:10]
		}
		for _, f := range files {
			name := f.Name()
			if !f.IsDir() && strings.HasSuffix(name, "_resumen.txt") {
				if strings.Contains(strings.ToLower(name), strings.ToLower(searchPart)) {
					summary, _ = os.ReadFile(filepath.Join(dir, name))
					break
				}
			}
		}
	}

	resp := map[string]string{
		"summary":    string(summary),
		"transcript": string(transcript),
		"debug_dir":  dir,
		"debug_base": baseName,
	}

	if string(summary) == "" && string(transcript) == "" {
		resp["error"] = fmt.Sprintf("Archivos no encontrados en %s. Verifica que whisper esté instalado.", dir)
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) CLIEnqueue(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	url := strings.TrimSpace(string(data))
	if url == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "empty url"})
		return
	}
	req := models.DownloadRequest{URL: url, Format: "video", Quality: "best"}
	body, _ := json.Marshal(req)
	r.Body = io.NopCloser(strings.NewReader(string(body)))
	h.QueueDownload(w, r)
}

func (h *Handler) ServeIndex(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, filepath.Join(h.publicPath, "index.html"))
}

func (h *Handler) Static() http.Handler {
	return http.StripPrefix("/assets/", http.FileServer(http.Dir(filepath.Join(h.publicPath, "assets"))))
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func detectPlatform(url string) string {
	low := strings.ToLower(url)
	switch {
	case strings.Contains(low, "spotify.com"):
		return "spotify"
	case strings.Contains(low, "music.apple.com"):
		return "apple-music"
	case strings.Contains(low, "youtu"):
		return "youtube"
	default:
		return "generic"
	}
}

func firstNotEmpty(items ...string) string {
	for _, item := range items {
		if strings.TrimSpace(item) != "" {
			return item
		}
	}
	return ""
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
