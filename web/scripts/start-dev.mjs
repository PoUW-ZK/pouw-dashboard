import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const modeIndex = args.indexOf("--mode");
const mode = args.find((arg) => arg.startsWith("--mode="))?.slice(7) || (modeIndex >= 0 ? args[modeIndex + 1] : "development");
const env = { ...loadEnv(mode, webRoot, "VITE_"), ...process.env };
const informational = args.some((arg) => ["--help", "-h", "--version", "-v"].includes(arg));

try {
  if (env.VITE_USE_MOCKS !== "true" && !informational) {
    try {
      const response = await fetch("http://127.0.0.1:8081/healthz", { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch {
      throw new Error(`Hasura is not running at http://127.0.0.1:8081.\nFor the full live stack, run:\n  ${resolve(webRoot, "../dev.sh")}\nFor a static preview without Docker, run:\n  ${resolve(webRoot, "../dev.sh")} preview`);
    }
  }
  const vite = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
  const result = spawnSync(process.execPath, [vite, ...args], { cwd: webRoot, stdio: "inherit", env });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 130;
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
}
