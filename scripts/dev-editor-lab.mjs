import { spawn } from "node:child_process";

const pnpmCli = process.env.npm_execpath;

if (!pnpmCli) {
  throw new Error("Run this command through pnpm: pnpm dev:editor-lab");
}

const child = spawn(process.execPath, [pnpmCli, "--filter", "web", "dev"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    EDITOR_LAB_ONLY: "true",
    SKIP_ENV_VALIDATION: "true",
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
