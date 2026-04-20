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
	Progress   int     `json:"progress"`
	Message    string  `json:"message"`
	FilePath   string  `json:"filePath,omitempty"`
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

	args := j.yt.BuildDownloadArgs(record, outDir)
	cmd := exec.Command(j.yt.binPath, args...)
	configureProcGroup(cmd)
	cmd.Stderr = cmd.Stdout
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		j.fail(recordID, err)
		return
	}

	if err := cmd.Start(); err != nil {
		j.fail(recordID, err)
		return
	}

	j.setRunning(recordID, cmd, outDir)
	defer j.clearRunning(recordID)

	if recCancel, _ := j.repo.GetByID(recordID); recCancel.Status == "canceled" {
		_ = KillProcessTree(cmd.Process.Pid)
		CleanupPartialDownloads(outDir)
		_ = cmd.Wait()
		return
	}

	var title string
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
				if strings.Contains(line, "Destination:") {
					title = extractTitleFromLine(line)
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
				j.fail(recordID, readErr)
			}
			break
		}
	}

	waitErr := cmd.Wait()
	recFinal, _ := j.repo.GetByID(recordID)
	switch strings.ToLower(recFinal.Status) {
	case "canceled":
		j.setStatus(recordID, JobStatus{ID: recordID, State: "canceled", Progress: 0, Message: "Canceled by user"})
		return
	case "paused":
		j.setStatus(recordID, JobStatus{ID: recordID, State: "paused", Progress: 0, Message: "Paused"})
		return
	}

	if waitErr != nil {
		j.fail(recordID, waitErr)
		return
	}

	filePath := detectLatestFile(outDir)
	_ = j.repo.UpdateStatus(recordID, "completed", filePath, "", title, 0)

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

	j.setStatus(recordID, JobStatus{ID: recordID, State: "completed", Progress: 100, Message: "Download & AI Processing completed", FilePath: filePath})
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
	defer j.mu.RUnlock()

	if v, ok := j.status[recordID]; ok {
		return v
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
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.ModTime().After(newestTime) {
			newestTime = info.ModTime()
			newest = filepath.Join(dir, entry.Name())
		}
	}
	return newest
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
