package main

import (
	"log"
	"net/http"

	"ytdown/internal/app"
)

func main() {
	server, err := app.New()
	if err != nil {
		log.Fatalf("failed to create app: %v", err)
	}

	log.Printf("YTDown running at http://%s", server.Config.Address)
	if err := http.ListenAndServe(server.Config.Address, server.Router); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
