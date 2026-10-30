package handlers

import (
	"net/http"

	"ytdown/internal/config"
)

func NewRouter(h *Handler, _ config.Config) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	mux.HandleFunc("POST /api/analyze", h.Analyze)
	mux.HandleFunc("POST /api/downloads", h.QueueDownload)
	mux.HandleFunc("POST /api/downloads/batch", h.QueueBatch)
	mux.HandleFunc("GET /api/downloads/{id}/file", h.DownloadFile)
	mux.HandleFunc("GET /api/downloads/file", h.DownloadFile)
	mux.HandleFunc("GET /api/status", h.DownloadStatus)
	mux.HandleFunc("GET /api/history", h.History)
	mux.HandleFunc("DELETE /api/history", h.ClearHistory)
	mux.HandleFunc("DELETE /api/history/{id}", h.DeleteHistoryItem)
	mux.HandleFunc("POST /api/jobs/control", h.ControlJob)
	mux.HandleFunc("DELETE /api/jobs/{id}", h.DeleteJob)
	mux.HandleFunc("GET /api/jobs/active", h.ActiveJobs)
	mux.HandleFunc("GET /api/stats", h.Stats)
	mux.HandleFunc("GET /api/setup", h.SetupInfo)
	mux.HandleFunc("GET /api/ai/summary", h.GetAISummary)
	mux.HandleFunc("POST /api/cli/enqueue", h.CLIEnqueue)
	mux.HandleFunc("GET /ws", h.Websocket)

	mux.Handle("GET /assets/", h.Static())
	mux.HandleFunc("GET /", h.ServeIndex)

	return withCORS(mux)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Disposition")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
