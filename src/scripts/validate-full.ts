import { spawnSync } from "node:child_process";

const commands = ["validate", "build", "test:e2e"];
for (const script of commands) {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const commandArgs = npmExecPath ? [npmExecPath, "run", script] : ["run", script];
  const result = spawnSync(command, commandArgs, { stdio: "inherit", env: { ...process.env, CI: "1" } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
