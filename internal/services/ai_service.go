package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type AIService struct {
	ffmpegPath string
}

func NewAIService(ffmpegPath string) *AIService {
	return &AIService{ffmpegPath: ffmpegPath}
}

// SeparateStems usa Spleeter (debe estar en el PATH) para separar audio.
func (s *AIService) SeparateStems(inputPath string, outputDir string) error {
	// Comando: spleeter separate -o outputDir inputPath
	cmd := exec.Command("spleeter", "separate", "-o", outputDir, inputPath)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("spleeter failed: %w", err)
	}
	return nil
}

// Transcribe usa Whisper (CLI local) para generar transcripción y un resumen.
func (s *AIService) Transcribe(inputPath string) error {
	dir := filepath.Dir(inputPath)
	fileName := filepath.Base(inputPath)
	baseName := strings.TrimSuffix(fileName, filepath.Ext(fileName))

	// 1. Generar transcripción completa (.txt)
	// Usamos --verbose False para no saturar el log y aseguramos el formato txt
	// IMPORTANTE: usamos `python -m whisper` porque python SIEMPRE está en el PATH,
	// mientras que el ejecutable de whisper está en Scripts/ (que puede requerir reinicio del terminal).
	cmd := exec.Command("python", "-m", "whisper", inputPath, "--model", "base", "--output_dir", dir, "--output_format", "txt", "--verbose", "False", "--device", "cpu")
	// PYTHONUTF8=1: necesario en Windows con Python 3.14 para evitar UnicodeEncodeError
	// cuando Whisper imprime caracteres no-latin en su salida/ayuda interna.
	cmd.Env = append(os.Environ(), "PYTHONUTF8=1")

	// Intentar ejecutar y capturar logs detallados
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("whisper failed: %w (output: %s)", err, string(output))
	}

	// 2. Localizar el archivo generado (Whisper a veces normaliza el nombre)
	txtPath := filepath.Join(dir, baseName+".txt")

	// Debug: Listar archivos si no se encuentra
	if _, err := os.Stat(txtPath); os.IsNotExist(err) {
		files, _ := os.ReadDir(dir)
		bestMatch := ""
		for _, f := range files {
			name := f.Name()
			// Whisper normaliza nombres (quita espacios, etc). Buscamos el .txt que más se parezca.
			if !f.IsDir() && strings.HasSuffix(name, ".txt") && !strings.Contains(name, "_resumen") {
				// Si el nombre contiene parte del baseName original, es muy probable que sea este
				searchPart := baseName
				if len(searchPart) > 10 {
					searchPart = searchPart[:10]
				}
				if strings.Contains(strings.ToLower(name), strings.ToLower(searchPart)) {
					bestMatch = filepath.Join(dir, name)
					break
				}
				if bestMatch == "" {
					bestMatch = filepath.Join(dir, name)
				}
			}
		}
		if bestMatch != "" {
			txtPath = bestMatch
		}
	}

	content, err := os.ReadFile(txtPath)
	if err != nil {
		return fmt.Errorf("transcript not found at %s: %w", txtPath, err)
	}

	// 3. Generar Resumen
	summaryPath := filepath.Join(dir, baseName+"_resumen.txt")
	summary := fmt.Sprintf("=== NEURAL_SUMMARY_REPORT ===\n")
	summary += fmt.Sprintf("SOURCE: %s\n", fileName)
	summary += fmt.Sprintf("DATE: %s\n", strings.ToUpper(filepath.Base(dir)))
	summary += fmt.Sprintf("-----------------------------\n\n")

	lines := strings.Split(string(content), "\n")
	count := 0
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "[") {
			summary += "• " + line + "\n"
			count++
		}
		if count >= 15 {
			break
		}
	}

	if count == 0 {
		summary += "NO_SIGNIFICANT_TEXT_DETECTED_FOR_SUMMARY"
	}

	return os.WriteFile(summaryPath, []byte(summary), 0644)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// GenerateBRoll detecta escenas y corta clips cortos.
func (s *AIService) GenerateBRoll(inputPath string, outputDir string) error {
	brollDir := filepath.Join(outputDir, "broll")
	_ = os.MkdirAll(brollDir, 0755)

	// Usamos ffmpeg para detectar cambios de escena y generar segmentos
	// Este es un ejemplo simplificado usando segmentación por tiempo para B-Roll
	cmd := exec.Command(s.ffmpegPath, "-i", inputPath, "-f", "segment", "-segment_time", "5", "-c", "copy",
		filepath.Join(brollDir, "clip_%03d.mp4"))

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg b-roll generation failed: %w", err)
	}
	return nil
}
