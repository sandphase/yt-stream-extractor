const { spawnSync, spawn } = require("child_process");
const path = require("path");
const os = require("os");

const root = path.resolve(__dirname, "..");
const setupResult = spawnSync("node", [path.join("scripts", "setup-runner.js")], {
  cwd: root,
  stdio: "inherit",
});

if (setupResult.status !== 0) process.exit(setupResult.status || 1);

const isWin = os.platform() === "win32";
const goCmd = isWin ? "go.exe" : "go";
const child = spawn(goCmd, ["run", "./cmd/server"], { cwd: root, stdio: "inherit" });
child.on("exit", (code) => process.exit(code || 0));
