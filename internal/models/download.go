package models

import "time"

type DownloadRecord struct {
	ID              int64     `json:"id"`
	SourceURL       string    `json:"sourceUrl"`
	SourcePlatform  string    `json:"sourcePlatform"`
	URL             string    `json:"url"`
	Title           string    `json:"title"`
	Artist          string    `json:"artist"`
	Album           string    `json:"album"`
	Format          string    `json:"format"`
	Container       string    `json:"container"`
	Quality         string    `json:"quality"`
	YTFormatID      string    `json:"ytFormatId"`
	VideoFPS        float64   `json:"videoFps"`
	AudioBitrate    int       `json:"audioBitrate"`
	OutputDir       string    `json:"outputDir"`
	ClipStart       string    `json:"clipStart"`
	ClipEnd         string    `json:"clipEnd"`
	AddMetadata     bool      `json:"addMetadata"`
	AISeparateStems bool      `json:"aiSeparateStems"`
	AITranscribe    bool      `json:"aiTranscribe"`
	AIGenerateBRoll bool      `json:"aiGenerateBRoll"`
	Status          string    `json:"status"`
	RetryCount      int       `json:"retryCount"`
	FilePath        string    `json:"filePath"`
	ErrorMsg        string    `json:"errorMsg"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// FormatChoice representa una opción real devuelta por yt-dlp (format_id o selector).
type FormatChoice struct {
	ID          string  `json:"id"`
	Label       string  `json:"label"`
	Height      int     `json:"height,omitempty"`
	FPS         float64 `json:"fps,omitempty"`
	BitrateKbps int     `json:"bitrateKbps,omitempty"`
	Kind        string  `json:"kind"` // video | audio
}

type AnalyzeResponse struct {
	Title             string         `json:"title"`
	Thumbnail         string         `json:"thumbnail"`
	ChannelThumbnail  string         `json:"channelThumbnail"`
	Duration          int            `json:"duration"`
	DurationFormatted string         `json:"durationFormatted"`
	Uploader          string         `json:"uploader"`
	ViewCount         int64          `json:"viewCount"`
	Categories        []string       `json:"categories"`
	VideoFormats      []FormatChoice `json:"videoFormats"`
	AudioFormats      []FormatChoice `json:"audioFormats"`
}

type DownloadRequest struct {
	URL             string  `json:"url"`
	Format          string  `json:"format"`
	Container       string  `json:"container"`
	Quality         string  `json:"quality"`
	YTFormatID      string  `json:"ytFormatId"`
	VideoFPS        float64 `json:"videoFps"`
	AudioBitrate    int     `json:"audioBitrate"`
	OutputDir       string  `json:"outputDir"`
	ClipStart       string  `json:"clipStart"`
	ClipEnd         string  `json:"clipEnd"`
	AddMetadata     bool    `json:"addMetadata"`
	AISeparateStems bool    `json:"aiSeparateStems"`
	AITranscribe    bool    `json:"aiTranscribe"`
	AIGenerateBRoll bool    `json:"aiGenerateBRoll"`
	Artist          string  `json:"artist"`
	Album           string  `json:"album"`
}

type BatchRequest struct {
	URLs       []string `json:"urls"`
	RawText    string   `json:"rawText"`
	Format     string   `json:"format"`
	Container  string   `json:"container"`
	Quality    string   `json:"quality"`
	OutputDir  string   `json:"outputDir"`
	ClipStart  string   `json:"clipStart"`
	ClipEnd    string   `json:"clipEnd"`
	Metadata   bool     `json:"metadata"`
	Artist     string   `json:"artist"`
	Album      string   `json:"album"`
	AutoLookup bool     `json:"autoLookup"`
}

type Subscription struct {
	ID            int64      `json:"id"`
	Name          string     `json:"name"`
	SourceURL     string     `json:"sourceUrl"`
	Format        string     `json:"format"`
	Quality       string     `json:"quality"`
	IntervalHours int        `json:"intervalHours"`
	Enabled       bool       `json:"enabled"`
	LastCheckedAt *time.Time `json:"lastCheckedAt"`
}

type Stats struct {
	TotalJobs         int64 `json:"totalJobs"`
	CompletedJobs     int64 `json:"completedJobs"`
	FailedJobs        int64 `json:"failedJobs"`
	QueuedJobs        int64 `json:"queuedJobs"`
	TotalStorageBytes int64 `json:"totalStorageBytes"`
}
