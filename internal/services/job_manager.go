package services

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"ytdown/internal/repository"
)

type JobStatus struct {
	ID         int64   `json:"id"`
	State      string  `json:"state"`
	Title      string  `json:"title,omitempty"`
	Progress   int     `json:"progress"`
	Message    string  `json:"message"`
	FilePath   string  `json:"-"`
	SpeedMiBs  float64 `json:"speedMiBs,omitempty"`
	ETADisplay string  `json:"etaDisplay,omitempty"`
}

type runningProc struct {
	cmd    *exec.Cmd
	outDir string
}

type JobManager struct {
	repo   *repository.DownloadRepository
	mu     sync.RWMutex
	status map[int64]JobStatus
	queue  chan int64
	// Proceso activo yt-dlp (para matar por PID / árbol)
	running map[int64]*runningProc
	paused  map[int64]bool
	notify  func(JobStatus)
	yt      *YouTubeService
	ai      *AIService
	cfg     JobRuntimeConfig
}

type JobRuntimeConfig struct {
	DefaultOutputDir string
}

func NewJobManager(repo *repository.DownloadRepository, yt *YouTubeService, ai *AIService, cfg JobRuntimeConfig) *JobManager {
	j := &JobManager{
		repo:    repo,
		status:  make(map[int64]JobStatus),
		queue:   make(chan int64, 1000),
		running: make(map[int64]*runningProc),
		paused:  make(map[int64]bool),
		yt:      yt,
		ai:      ai,
		cfg:     cfg,
	}
	go j.worker()
	return j
}

func (j *JobManager) SetNotifier(cb func(JobStatus)) { j.notify = cb }

func (j *JobManager) Enqueue(recordID int64) {
	j.setStatus(recordID, JobStatus{ID: recordID, State: "queued", Progress: 0, Message: "Queued"})
	j.queue <- recordID
}

func (j *JobManager) worker() {
	for id := range j.queue {
		j.process(id)
	}
}

func (j *JobManager) process(recordID int64) {
	record, err := j.repo.GetByID(recordID)
	if err != nil {
		return
	}
	if record.Status == "canceled" {
		return
	}

	outDir := record.OutputDir
	if outDir == "" {
		outDir = j.cfg.DefaultOutputDir
	}
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		_ = j.repo.UpdateStatus(recordID, "failed", "", err.Error(), "", 1)
		j.setStatus(recordID, JobStatus{ID: recordID, State: "failed", Progress: 0, Message: err.Error()})
		return
	}

	rec2, _ := j.repo.GetByID(recordID)
	if rec2.Status == "canceled" {
		return
	}

	j.setStatus(recordID, JobStatus{ID: recordID, State: "processing", Progress: 5, Message: "Starting download..."})
	_ = j.repo.UpdateStatus(recordID, "processing", "", "", "", 0)

	var title string
	var lastErrorMsg string
	var detectedDest string
	jobStartTime := time.Now().Add(-5 * time.Second)

	attemptDownload := func(useProxy bool) error {
		args := j.yt.BuildDownloadArgs(record, outDir, useProxy)
		cmd := exec.Command(j.yt.binPath, args...)
		configureProcGroup(cmd)
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			return err
		}
		cmd.Stderr = cmd.Stdout

		if err := cmd.Start(); err != nil {
			return err
		}

		j.setRunning(recordID, cmd, outDir)
		defer j.clearRunning(recordID)

		if recCancel, _ := j.repo.GetByID(recordID); recCancel.Status == "canceled" {
			_ = KillProcessTree(cmd.Process.Pid)
			CleanupPartialDownloads(outDir)
			_ = cmd.Wait()
			return fmt.Errorf("canceled")
		}

		lastPct := 5
		var lastSpd float64
		var lastETA string
		buf := make([]byte, 2048)
		remainder := ""
		for {
			n, readErr := stdout.Read(buf)
			if n > 0 {
				chunk := remainder + string(buf[:n])
				lines := strings.Split(chunk, "\n")
				remainder = lines[len(lines)-1]
				for _, line := range lines[:len(lines)-1] {
					line = strings.TrimSpace(line)
					if line == "" {
						continue
					}
					if strings.Contains(line, "ERROR:") || strings.Contains(line, "Sign in to confirm") || strings.Contains(line, "LOGIN_REQUIRED") || strings.Contains(line, "Please sign in") {
						lastErrorMsg = line
					}
					if strings.Contains(line, "Destination:") {
						destPath := extractTitleFromLine(line)
						if destPath != "" {
							detectedDest = destPath
							title = strings.TrimSuffix(filepath.Base(destPath), filepath.Ext(destPath))
						}
					}
					if !strings.Contains(line, "[download]") && !strings.Contains(line, "Destination:") && !strings.Contains(line, "Merger") {
						continue
					}
					pct, hasPct, spd, eta := ParseYtDlpProgressLine(line)
					if hasPct {
						lastPct = pct
					}
					if spd > 0 {
						lastSpd = spd
					}
					if eta != "" {
						lastETA = eta
					}
					legacy := parseProgress(line)
					if legacy >= 0 && !hasPct {
						lastPct = legacy
					}
					j.setStatus(recordID, JobStatus{
						ID:         recordID,
						State:      "processing",
						Progress:   lastPct,
						Message:    line,
						SpeedMiBs:  lastSpd,
						ETADisplay: lastETA,
					})
				}
			}
			if readErr != nil {
				if readErr != io.EOF && !j.isCanceledOrPausedInDB(recordID) {
					return readErr
				}
				break
			}
		}

		waitErr := cmd.Wait()
		recFinal, _ := j.repo.GetByID(recordID)
		switch strings.ToLower(recFinal.Status) {
		case "canceled":
			return fmt.Errorf("canceled")
		case "paused":
			return fmt.Errorf("paused")
		}

		if waitErr != nil {
			if lastErrorMsg != "" {
				return fmt.Errorf("%s", lastErrorMsg)
			}
			return waitErr
		}
		return nil
	}

	// 1. Motor primario de alta velocidad (Invidious Stream Engine + FFmpeg)
	invPath, invTitle, invErr := j.yt.DownloadViaInvidious(
		record,
		outDir,
		func() bool { return j.isCanceledOrPausedInDB(recordID) },
		func(pct int, msg string, spd float64, eta string) {
			j.setStatus(recordID, JobStatus{
				ID:         recordID,
				State:      "processing",
				Title:      record.Title,
				Progress:   pct,
				Message:    msg,
				SpeedMiBs:  spd,
				ETADisplay: eta,
			})
		},
	)
	if invErr == nil && invPath != "" {
		detectedDest = invPath
		title = invTitle
		err = nil
	} else {
		recCheck, _ := j.repo.GetByID(recordID)
		if recCheck.Status == "canceled" || recCheck.Status == "paused" {
			return
		}
		// 2. Fallback a yt-dlp (usando túnel SOCKS5 primero si está activo)
		if IsSocksProxyAvailable() {
			err = attemptDownload(true)
			if err != nil && !j.isCanceledOrPausedInDB(recordID) {
				detectedDest = ""
				lastErrorMsg = ""
				err = attemptDownload(false)
			}
		} else {
			err = attemptDownload(false)
		}
	}

	recFinal, _ := j.repo.GetByID(recordID)
	switch strings.ToLower(recFinal.Status) {
	case "canceled":
		j.setStatus(recordID, JobStatus{ID: recordID, State: "canceled", Progress: 0, Message: "Canceled by user"})
		return
	case "paused":
		j.setStatus(recordID, JobStatus{ID: recordID, State: "paused", Progress: 0, Message: "Paused"})
		return
	}

	if err != nil {
		j.fail(recordID, fmt.Errorf("No se pudo procesar este enlace en este momento. Verifica que el video sea público e inténtalo de nuevo."))
		return
	}

	filePath := ""
	if detectedDest != "" {
		if fi, err := os.Stat(detectedDest); err == nil && !fi.IsDir() && fi.Size() > 0 {
			filePath = detectedDest
		}
	}
	if filePath == "" {
		filePath = findJobOutputFile(outDir, record.URL, jobStartTime)
	}
	if filePath == "" {
		filePath = detectLatestFileAfter(outDir, jobStartTime)
	}
	if filePath == "" {
		// Fallback por si la fecha en sistema no coincidiera exactamente
		filePath = detectLatestFile(outDir)
	}

	if filePath == "" {
		j.fail(recordID, fmt.Errorf("No se pudo generar el archivo multimedia. Intenta nuevamente."))
		return
	}

	cleanTitle := title
	if cleanTitle == "" {
		base := filepath.Base(filePath)
		cleanTitle = strings.TrimSuffix(base, filepath.Ext(base))
	}
	if cleanTitle == "" {
		cleanTitle = record.Title
	}
	_ = j.repo.UpdateStatus(recordID, "completed", filePath, "", cleanTitle, 0)

	// Post-procesamiento IA
	if filePath != "" {
		if record.AISeparateStems {
			j.setStatus(recordID, JobStatus{ID: recordID, State: "processing", Progress: 90, Message: "AI: Separating audio tracks..."})
			_ = j.ai.SeparateStems(filePath, outDir)
		}
		if record.AITranscribe {
			j.setStatus(recordID, JobStatus{ID: recordID, State: "processing", Progress: 95, Message: "AI: Transcribing audio..."})
			_ = j.ai.Transcribe(filePath)
		}
		if record.AIGenerateBRoll {
			j.setStatus(recordID, JobStatus{ID: recordID, State: "processing", Progress: 98, Message: "AI: Generating B-Roll clips..."})
			_ = j.ai.GenerateBRoll(filePath, outDir)
		}
	}

	j.setStatus(recordID, JobStatus{ID: recordID, State: "completed", Title: cleanTitle, Progress: 100, Message: "Download & AI Processing completed", FilePath: filePath})
}

func (j *JobManager) isCanceledOrPausedInDB(id int64) bool {
	rec, err := j.repo.GetByID(id)
	if err != nil {
		return false
	}
	s := strings.ToLower(rec.Status)
	return s == "canceled" || s == "paused"
}

func (j *JobManager) setRunning(id int64, cmd *exec.Cmd, outDir string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.running[id] = &runningProc{cmd: cmd, outDir: outDir}
}

func (j *JobManager) clearRunning(id int64) {
	j.mu.Lock()
	defer j.mu.Unlock()
	delete(j.running, id)
}

func (j *JobManager) fail(id int64, err error) {
	_ = j.repo.UpdateStatus(id, "failed", "", err.Error(), "", 1)
	j.setStatus(id, JobStatus{ID: id, State: "failed", Progress: 0, Message: err.Error()})
}

func (j *JobManager) Status(recordID int64) JobStatus {
	j.mu.RLock()
	if v, ok := j.status[recordID]; ok {
		j.mu.RUnlock()
		return v
	}
	j.mu.RUnlock()

	if rec, err := j.repo.GetByID(recordID); err == nil {
		prog := 0
		if rec.Status == "completed" {
			prog = 100
		}
		return JobStatus{
			ID:       recordID,
			State:    rec.Status,
			Title:    rec.Title,
			Progress: prog,
			Message:  rec.ErrorMsg,
			FilePath: rec.FilePath,
		}
	}
	return JobStatus{ID: recordID, State: "unknown", Progress: 0, Message: "No active job"}
}

// ForceCancel mata el proceso yt-dlp (y subprocesos), limpia .part/.ytdl y marca el trabajo como cancelado.
func (j *JobManager) ForceCancel(id int64) {
	rec, err := j.repo.GetByID(id)
	if err != nil {
		return
	}
	switch strings.ToLower(rec.Status) {
	case "completed", "failed", "canceled":
		return
	}

	j.mu.Lock()
	rp := j.running[id]
	j.mu.Unlock()

	if rp != nil && rp.cmd != nil && rp.cmd.Process != nil {
		pid := rp.cmd.Process.Pid
		_ = KillProcessTree(pid)
		CleanupPartialDownloads(rp.outDir)
	}

	_ = j.repo.UpdateStatus(id, "canceled", "", "Canceled by user", "", 0)
	j.setStatus(id, JobStatus{ID: id, State: "canceled", Progress: 0, Message: "Canceled by user"})
}

func (j *JobManager) Pause(id int64) {
	j.mu.Lock()
	j.paused[id] = true
	rp := j.running[id]
	j.mu.Unlock()

	if rp != nil && rp.cmd != nil && rp.cmd.Process != nil {
		_ = KillProcessTree(rp.cmd.Process.Pid)
	}
	_ = j.repo.UpdateStatus(id, "paused", "", "", "", 0)
	j.setStatus(id, JobStatus{ID: id, State: "paused", Progress: 0, Message: "Paused"})
}

func (j *JobManager) Resume(id int64) {
	j.mu.Lock()
	delete(j.paused, id)
	j.mu.Unlock()
	j.Enqueue(id)
}

func (j *JobManager) ExportQueueState() string {
	j.mu.RLock()
	defer j.mu.RUnlock()
	data, _ := json.Marshal(j.status)
	return string(data)
}

func (j *JobManager) setStatus(id int64, st JobStatus) {
	j.mu.Lock()
	j.status[id] = st
	j.mu.Unlock()
	if j.notify != nil {
		j.notify(st)
	}
}

func (j *JobManager) isPaused(id int64) bool {
	j.mu.RLock()
	defer j.mu.RUnlock()
	return j.paused[id]
}

func parseProgress(line string) int {
	if idx := strings.Index(line, "%"); idx > 0 {
		start := idx - 1
		for start >= 0 && (line[start] == '.' || (line[start] >= '0' && line[start] <= '9')) {
			start--
		}
		var value float64
		_, err := fmt.Sscanf(line[start+1:idx], "%f", &value)
		if err == nil {
			if value < 0 {
				return 0
			}
			if value > 100 {
				return 100
			}
			return int(value)
		}
	}
	return -1
}

func detectLatestFile(dir string) string {
	return detectLatestFileAfter(dir, time.Time{})
}

func detectLatestFileAfter(dir string, after time.Time) string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return ""
	}

	var newest string
	var newestTime time.Time
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		// Ignorar fragmentos temporales o placeholders
		name := entry.Name()
		if strings.HasSuffix(name, ".part") || strings.HasSuffix(name, ".ytdl") || strings.HasPrefix(name, "Stream_Extraction_") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if !after.IsZero() && !info.ModTime().After(after) {
			continue
		}
		if info.ModTime().After(newestTime) {
			newestTime = info.ModTime()
			newest = filepath.Join(dir, entry.Name())
		}
	}
	return newest
}

func findJobOutputFile(dir string, rawUrl string, after time.Time) string {
	videoID := extractVideoIDFromURL(rawUrl)
	if videoID == "" {
		return ""
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return ""
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.Contains(name, videoID) && !strings.HasSuffix(name, ".part") && !strings.HasSuffix(name, ".ytdl") {
			return filepath.Join(dir, name)
		}
	}
	return ""
}

func extractVideoIDFromURL(rawUrl string) string {
	if idx := strings.Index(rawUrl, "v="); idx != -1 {
		part := rawUrl[idx+2:]
		if amp := strings.Index(part, "&"); amp != -1 {
			part = part[:amp]
		}
		return part
	}
	if strings.Contains(rawUrl, "youtu.be/") {
		parts := strings.Split(rawUrl, "youtu.be/")
		if len(parts) > 1 {
			part := parts[1]
			if q := strings.Index(part, "?"); q != -1 {
				part = part[:q]
			}
			return part
		}
	}
	return ""
}

func extractTitleFromLine(line string) string {
	if idx := strings.Index(line, "Destination:"); idx >= 0 {
		return strings.TrimSpace(line[idx+12:])
	}
	return ""
}

// ActiveJobs devuelve estados en memoria para la barra inferior (processing/queued).
func (j *JobManager) ActiveJobs() []JobStatus {
	j.mu.RLock()
	defer j.mu.RUnlock()
	out := make([]JobStatus, 0, len(j.status))
	for _, st := range j.status {
		s := strings.ToLower(st.State)
		if s == "processing" || s == "queued" || (s == "paused" && st.Progress > 0) {
			out = append(out, st)
		}
	}
	return out
}

func cleanSafeFilename(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "descarga"
	}
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' || r == '(' || r == ')' {
			b.WriteRune(r)
		} else if r == ' ' {
			b.WriteRune('_')
		} else {
			b.WriteRune('_')
		}
	}
	res := strings.Trim(b.String(), "_")
	for strings.Contains(res, "__") {
		res = strings.ReplaceAll(res, "__", "_")
	}
	if res == "" {
		return "descarga"
	}
	return res
}
