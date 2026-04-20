//go:build windows

package services

import "os/exec"

func configureProcGroup(_ *exec.Cmd) {}
