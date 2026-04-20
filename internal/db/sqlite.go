package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

func New(path string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create db dir: %w", err)
	}

	database, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	if err := migrate(database); err != nil {
		return nil, err
	}

	return database, nil
}

func migrate(database *sql.DB) error {
	const schema = `
CREATE TABLE IF NOT EXISTS downloads (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	source_url TEXT NOT NULL,
	source_platform TEXT NOT NULL DEFAULT 'youtube',
	url TEXT NOT NULL,
	title TEXT,
	artist TEXT,
	album TEXT,
	format TEXT NOT NULL,
	container TEXT NOT NULL DEFAULT '',
	quality TEXT NOT NULL,
	output_dir TEXT NOT NULL DEFAULT '',
	clip_start TEXT NOT NULL DEFAULT '',
	clip_end TEXT NOT NULL DEFAULT '',
	add_metadata INTEGER NOT NULL DEFAULT 0,
	status TEXT NOT NULL,
	retry_count INTEGER NOT NULL DEFAULT 0,
	file_path TEXT,
	error_msg TEXT,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	source_url TEXT NOT NULL,
	format TEXT NOT NULL,
	quality TEXT NOT NULL,
	interval_hours INTEGER NOT NULL DEFAULT 6,
	enabled INTEGER NOT NULL DEFAULT 1,
	last_checked_at DATETIME,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_logs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	level TEXT NOT NULL,
	message TEXT NOT NULL,
	context TEXT,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`

	if _, err := database.Exec(schema); err != nil {
		return fmt.Errorf("run migration: %w", err)
	}

	if err := migrateDownloadsColumns(database); err != nil {
		return err
	}

	return nil
}

// migrateDownloadsColumns upgrades DBs created before new columns existed.
// CREATE TABLE IF NOT EXISTS does not alter existing tables.
func migrateDownloadsColumns(database *sql.DB) error {
	cols, err := tableColumns(database, "downloads")
	if err != nil {
		return err
	}
	if len(cols) == 0 {
		return nil
	}

	alterations := []struct {
		name string
		sql  string
	}{
		{"source_url", `ALTER TABLE downloads ADD COLUMN source_url TEXT NOT NULL DEFAULT ''`},
		{"source_platform", `ALTER TABLE downloads ADD COLUMN source_platform TEXT NOT NULL DEFAULT 'youtube'`},
		{"artist", `ALTER TABLE downloads ADD COLUMN artist TEXT`},
		{"album", `ALTER TABLE downloads ADD COLUMN album TEXT`},
		{"container", `ALTER TABLE downloads ADD COLUMN container TEXT NOT NULL DEFAULT ''`},
		{"output_dir", `ALTER TABLE downloads ADD COLUMN output_dir TEXT NOT NULL DEFAULT ''`},
		{"clip_start", `ALTER TABLE downloads ADD COLUMN clip_start TEXT NOT NULL DEFAULT ''`},
		{"clip_end", `ALTER TABLE downloads ADD COLUMN clip_end TEXT NOT NULL DEFAULT ''`},
		{"add_metadata", `ALTER TABLE downloads ADD COLUMN add_metadata INTEGER NOT NULL DEFAULT 0`},
		{"retry_count", `ALTER TABLE downloads ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0`},
		{"yt_format_id", `ALTER TABLE downloads ADD COLUMN yt_format_id TEXT NOT NULL DEFAULT ''`},
		{"video_fps", `ALTER TABLE downloads ADD COLUMN video_fps REAL NOT NULL DEFAULT 0`},
		{"audio_bitrate", `ALTER TABLE downloads ADD COLUMN audio_bitrate INTEGER NOT NULL DEFAULT 0`},
		{"ai_separate_stems", `ALTER TABLE downloads ADD COLUMN ai_separate_stems INTEGER NOT NULL DEFAULT 0`},
		{"ai_transcribe", `ALTER TABLE downloads ADD COLUMN ai_transcribe INTEGER NOT NULL DEFAULT 0`},
		{"ai_generate_broll", `ALTER TABLE downloads ADD COLUMN ai_generate_broll INTEGER NOT NULL DEFAULT 0`},
	}

	for _, a := range alterations {
		if cols[a.name] {
			continue
		}
		if _, err := database.Exec(a.sql); err != nil {
			if isDuplicateColumn(err) {
				continue
			}
			return fmt.Errorf("migrate downloads add %s: %w", a.name, err)
		}
		cols[a.name] = true
	}

	// Backfill source_url from url for rows that still have empty source_url
	if _, err := database.Exec(`UPDATE downloads SET source_url = url WHERE source_url = '' OR source_url IS NULL`); err != nil {
		return fmt.Errorf("backfill source_url: %w", err)
	}

	return nil
}

func tableColumns(database *sql.DB, table string) (map[string]bool, error) {
	if table != "downloads" {
		return nil, fmt.Errorf("invalid table for migration")
	}
	rows, err := database.Query("PRAGMA table_info(downloads)")
	if err != nil {
		return nil, fmt.Errorf("pragma table_info: %w", err)
	}
	defer rows.Close()

	out := make(map[string]bool)
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return nil, err
		}
		out[name] = true
	}
	return out, rows.Err()
}

func isDuplicateColumn(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate column") || strings.Contains(msg, "already exists")
}
