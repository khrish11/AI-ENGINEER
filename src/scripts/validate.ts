import { spawnSync } from "node:child_process";

const commands = [
  ["typecheck", []],
  ["lint", []],
  ["resources:validate", []],
  ["roadmap:validate", []],
  ["projects:validate", []],
  ["assessments:validate", []],
  ["mcp:validate", []],
  ["test", ["--", "--run"]],
] as const;

for (const [script, args] of commands) {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const commandArgs = npmExecPath ? [npmExecPath, "run", script, ...args] : ["run", script, ...args];
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
