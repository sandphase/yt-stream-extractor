package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
)

func main() {
	baseURL := flag.String("api", "http://127.0.0.1:8090", "API base URL")
	url := flag.String("url", "", "URL a encolar")
	format := flag.String("format", "video", "video|audio")
	container := flag.String("container", "mp4", "mp4|mkv|mp3|flac")
	quality := flag.String("quality", "best", "best|4320|2160|1440|1080|720|480")
	flag.Parse()

	if *url == "" {
		fmt.Println("Uso: go run ./cmd/cli --url <url>")
		os.Exit(1)
	}

	payload := map[string]any{
		"url":       *url,
		"format":    *format,
		"container": *container,
		"quality":   *quality,
	}

	body, _ := json.Marshal(payload)
	resp, err := http.Post(*baseURL+"/api/downloads", "application/json", bytes.NewReader(body))
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	responseBody, _ := io.ReadAll(resp.Body)
	fmt.Println(string(responseBody))
}
