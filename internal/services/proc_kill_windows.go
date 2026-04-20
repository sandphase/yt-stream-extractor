//go:build windows

package services

import (
	"os/exec"
	"strconv"
)

func KillProcessTree(pid int) error {
	if pid <= 0 {
		return nil
	}
	return exec.Command("taskkill", "/PID", strconv.Itoa(pid), "/T", "/F").Run()
}
