package app

import (
	"net/http"

	"ytdown/internal/config"
	"ytdown/internal/db"
	"ytdown/internal/handlers"
	"ytdown/internal/repository"
	"ytdown/internal/services"
)

type Server struct {
	Config config.Config
	Router http.Handler
}

func New() (*Server, error) {
	cfg := config.Load()

	database, err := db.New(cfg.DatabasePath)
	if err != nil {
		return nil, err
	}

	downloadRepo := repository.NewDownloadRepository(database)
	yt := services.NewYouTubeService(cfg.YTDLPPath)
	ai := services.NewAIService(cfg.FFmpegPath)
	jobManager := services.NewJobManager(downloadRepo, yt, ai, services.JobRuntimeConfig{DefaultOutputDir: cfg.DownloadDir})
	wsHub := services.NewWebsocketHub()
	jobManager.SetNotifier(func(st services.JobStatus) {
		wsHub.Broadcast(map[string]any{
			"type": "job_update",
			"data": st,
		})
	})

	h := handlers.NewHandler(downloadRepo, jobManager, yt, wsHub, cfg)
	router := handlers.NewRouter(h, cfg)

	return &Server{
		Config: cfg,
		Router: router,
	}, nil
}
