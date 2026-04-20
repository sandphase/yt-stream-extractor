package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"ytdown/internal/models"
)

type DownloadRepository struct {
	db *sql.DB
}

func NewDownloadRepository(db *sql.DB) *DownloadRepository {
	return &DownloadRepository{db: db}
}

func (r *DownloadRepository) Create(record *models.DownloadRecord) (int64, error) {
	const query = `
INSERT INTO downloads (
	source_url, source_platform, url, title, artist, album, format, container, quality,
	yt_format_id, video_fps, audio_bitrate,
	output_dir,
	clip_start, clip_end, add_metadata, ai_separate_stems, ai_transcribe, ai_generate_broll, status, retry_count, file_path, error_msg
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`
	result, err := r.db.Exec(
		query,
		record.SourceURL, record.SourcePlatform, record.URL, record.Title, record.Artist, record.Album,
		record.Format, record.Container, record.Quality,
		record.YTFormatID, record.VideoFPS, record.AudioBitrate,
		record.OutputDir,
		record.ClipStart, record.ClipEnd, boolToInt(record.AddMetadata),
		boolToInt(record.AISeparateStems), boolToInt(record.AITranscribe), boolToInt(record.AIGenerateBRoll),
		record.Status, record.RetryCount, record.FilePath, record.ErrorMsg,
	)
	if err != nil {
		return 0, fmt.Errorf("insert download: %w", err)
	}
	return result.LastInsertId()
}

func (r *DownloadRepository) UpdateStatus(id int64, status, filePath, errorMsg, title string, retryDelta int) error {
	const query = `
UPDATE downloads
SET status = ?, file_path = ?, error_msg = ?, title = CASE WHEN ? <> '' THEN ? ELSE title END,
	retry_count = retry_count + ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?
`
	_, err := r.db.Exec(query, status, filePath, errorMsg, title, title, retryDelta, id)
	if err != nil {
		return fmt.Errorf("update status: %w", err)
	}
	return nil
}

func (r *DownloadRepository) GetByID(id int64) (models.DownloadRecord, error) {
	const query = `
SELECT id, source_url, source_platform, url, title, artist, album, format, container, quality,
	yt_format_id, video_fps, audio_bitrate,
	output_dir, clip_start, clip_end,
	add_metadata, ai_separate_stems, ai_transcribe, ai_generate_broll,
	status, retry_count, file_path, error_msg, created_at, updated_at
FROM downloads
WHERE id = ?
`
	var rec models.DownloadRecord
	var addMetadata, aiSep, aiTrans, aiBroll int
	err := r.db.QueryRow(query, id).Scan(
		&rec.ID, &rec.SourceURL, &rec.SourcePlatform, &rec.URL, &rec.Title, &rec.Artist, &rec.Album, &rec.Format, &rec.Container,
		&rec.Quality, &rec.YTFormatID, &rec.VideoFPS, &rec.AudioBitrate,
		&rec.OutputDir, &rec.ClipStart, &rec.ClipEnd,
		&addMetadata, &aiSep, &aiTrans, &aiBroll,
		&rec.Status, &rec.RetryCount, &rec.FilePath,
		&rec.ErrorMsg, &rec.CreatedAt, &rec.UpdatedAt,
	)
	if err != nil {
		return models.DownloadRecord{}, fmt.Errorf("get by id: %w", err)
	}
	rec.AddMetadata = addMetadata == 1
	rec.AISeparateStems = aiSep == 1
	rec.AITranscribe = aiTrans == 1
	rec.AIGenerateBRoll = aiBroll == 1
	return rec, nil
}

func (r *DownloadRepository) List(limit int) ([]models.DownloadRecord, error) {
	const query = `
SELECT id, source_url, source_platform, url, title, artist, album, format, container, quality,
	yt_format_id, video_fps, audio_bitrate,
	output_dir, clip_start, clip_end,
	add_metadata, ai_separate_stems, ai_transcribe, ai_generate_broll,
	status, retry_count, file_path, error_msg, created_at, updated_at
FROM downloads
ORDER BY created_at DESC
LIMIT ?
`
	rows, err := r.db.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("list downloads: %w", err)
	}
	defer rows.Close()

	items := make([]models.DownloadRecord, 0)
	for rows.Next() {
		var rec models.DownloadRecord
		var addMetadata, aiSep, aiTrans, aiBroll int
		if err := rows.Scan(
			&rec.ID, &rec.SourceURL, &rec.SourcePlatform, &rec.URL, &rec.Title, &rec.Artist, &rec.Album, &rec.Format, &rec.Container,
			&rec.Quality, &rec.YTFormatID, &rec.VideoFPS, &rec.AudioBitrate,
			&rec.OutputDir, &rec.ClipStart, &rec.ClipEnd,
			&addMetadata, &aiSep, &aiTrans, &aiBroll,
			&rec.Status, &rec.RetryCount, &rec.FilePath,
			&rec.ErrorMsg, &rec.CreatedAt, &rec.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan download: %w", err)
		}
		rec.AddMetadata = addMetadata == 1
		rec.AISeparateStems = aiSep == 1
		rec.AITranscribe = aiTrans == 1
		rec.AIGenerateBRoll = aiBroll == 1
		items = append(items, rec)
	}
	return items, nil
}

func (r *DownloadRepository) Stats(totalStorage int64) (models.Stats, error) {
	rows, err := r.db.Query(`SELECT status, COUNT(*) FROM downloads GROUP BY status`)
	if err != nil {
		return models.Stats{}, fmt.Errorf("load stats: %w", err)
	}
	defer rows.Close()

	stats := models.Stats{TotalStorageBytes: totalStorage}
	for rows.Next() {
		var status string
		var count int64
		if err := rows.Scan(&status, &count); err != nil {
			return models.Stats{}, err
		}
		stats.TotalJobs += count
		switch strings.ToLower(status) {
		case "completed":
			stats.CompletedJobs += count
		case "failed", "canceled":
			stats.FailedJobs += count
		case "queued", "processing", "paused":
			stats.QueuedJobs += count
		}
	}
	return stats, nil
}

func (r *DownloadRepository) Log(level, message, context string) {
	_, _ = r.db.Exec(`INSERT INTO system_logs (level, message, context) VALUES (?, ?, ?)`, level, message, context)
}

func (r *DownloadRepository) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM downloads WHERE id = ?`, id)
	return err
}

func (r *DownloadRepository) DeleteAll() error {
	_, err := r.db.Exec(`DELETE FROM downloads`)
	return err
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
