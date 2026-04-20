const { spawnSync } = require("child_process");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const isWin = os.platform() === "win32";
const script = isWin ? "setup.bat" : "setup.sh";

const cmd = isWin ? "cmd" : "bash";
const args = isWin ? ["/c", script] : [script];
const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });

if (result.status !== 0) {
  process.exit(result.status || 1);
}
