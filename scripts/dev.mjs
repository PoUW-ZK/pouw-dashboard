import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { platform, release } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = join(repoRoot, "web");
const launcher = join(repoRoot, "dev.sh");
const project = "dashboard-check";
const explorerUrl = "http://127.0.0.1:8080";

function capture(command, args) {
  return spawnSync(command, args, { cwd: repoRoot, encoding: "utf8", timeout: 10_000 });
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed${result.signal ? ` (${result.signal})` : ` (exit ${result.status})`}.`);
}

export function kernelIssue({ running, loaded, probeOk, modulesPresent, installed }) {
  if (loaded || probeOk) return undefined;
  if (!modulesPresent) {
    return `Docker networking cannot start: veth is not loaded and the modules for the running kernel ${running} are missing.\nInstalled module versions: ${installed.join(", ") || "none"}.\nSave your work and reboot to load the updated kernel, then run ${launcher} again.`;
  }
  return "Docker's veth module is unavailable. Run sudo modprobe veth in your terminal and check its error before starting Docker containers.";
}

function checkKernel() {
  if (platform() !== "linux" || process.env.DOCKER_HOST && !process.env.DOCKER_HOST.startsWith("unix:")) return;
  // A remote Docker context uses its own kernel, not this workstation's.
  const context = capture("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  if (context.status === 0 && !context.stdout.trim().startsWith("unix:")) return;
  const probe = capture("modprobe", ["--dry-run", "veth"]);
  if (probe.error?.code === "ENOENT") return; // Non-kmod hosts: let Docker report its own requirements.
  const directory = "/usr/lib/modules";
  const issue = kernelIssue({
    running: release(),
    loaded: existsSync("/sys/module/veth"),
    probeOk: probe.status === 0,
    modulesPresent: existsSync(join(directory, release())),
    installed: existsSync(directory) ? readdirSync(directory).sort() : [],
  });
  if (issue) throw new Error(issue);
}

function dockerCommand() {
  const info = capture("docker", ["info", "--format", "{{.ServerVersion}}"]);
  if (info.error?.code === "ENOENT") throw new Error("Install Docker Engine and the Docker Compose plugin first.");
  if (info.status === 0) return ["docker"];
  if (!/permission denied|access denied/i.test(`${info.stdout}${info.stderr}`)) {
    throw new Error(`Docker is not responding. Start it with sudo systemctl start docker, then rerun ${launcher}.`);
  }
  console.log("Docker requires sudo on this account. Only Docker commands will use sudo.");
  run("sudo", ["docker", "info", "--format", "{{.ServerVersion}}"]);
  // sudo normally strips these public build flags; keep the demo configuration
  // and explicitly configured reward addresses when invoking Compose as root.
  return ["sudo", "--preserve-env=VITE_USE_MOCKS,VITE_SHOW_POUW,VITE_NODE_1_MINER_ADDRESS,VITE_NODE_2_MINER_ADDRESS,VITE_NODE_3_MINER_ADDRESS", "docker"];
}

export function composeArgs(args) {
  return ["compose", "--project-directory", repoRoot, "-f", join(repoRoot, "compose.yml"), "-p", project, "--profile", "mock", ...args];
}

function compose(docker, args, env) {
  run(docker[0], [...docker.slice(1), ...composeArgs(args)], env);
}

async function waitForApi() {
  const { queries } = JSON.parse(readFileSync(join(webRoot, "src/graphql/operations.json"), "utf8"));
  const deadline = Date.now() + 90_000;
  let reason = "API not ready";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${explorerUrl}/v1/graphql`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queries.HomeStats }), signal: AbortSignal.timeout(3000),
      });
      const body = await response.json();
      if (response.ok && Array.isArray(body.data?.stats) && !body.errors?.length) return;
      reason = body.errors?.map((error) => error.message).join("; ") || `HTTP ${response.status}`;
    } catch (error) { reason = error.message; }
    await delay(1500);
  }
  throw new Error(`Explorer API did not become ready: ${reason}\nSee logs with ${launcher} logs`);
}

function frontendDependencies() {
  if (!existsSync(join(webRoot, "node_modules/.bin/vite"))) run("npm", ["--prefix", webRoot, "ci"]);
}

async function main() {
  const [command = "up", ...args] = process.argv.slice(2);
  if (["help", "--help", "-h"].includes(command)) {
    console.log(`Usage: ${launcher} [up|preview|check|test-api|doctor|logs|stop]

  up                 Build and start Postgres, Hasura and explorer; check API; start live mock blocks.
  preview            Show static sample data at localhost:5173 without Docker or Hasura.
  check              Run frontend tests, lint, build and allow-list checks without Docker.
  test-api [URL]     Check anonymous HTTP and WebSocket operations (default localhost:8080).
  doctor             Check kernel modules and Docker access without changing the system.
  logs               Show the test stack's recent logs.
  stop               Stop the test stack, preserving its database.

Run this as your regular user. The launcher requests sudo for Docker only when required.`);
    return;
  }
  if (command === "preview") {
    frontendDependencies();
    console.log("Starting static preview data at http://localhost:5173 (no live blockchain connection).");
    run("npm", ["--prefix", webRoot, "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"], { ...process.env, VITE_USE_MOCKS: "true", VITE_SHOW_POUW: "false" });
    return;
  }
  if (command === "check") {
    frontendDependencies();
    for (const task of ["test", "lint", "build"]) run("npm", ["--prefix", webRoot, "run", task], { ...process.env, VITE_USE_MOCKS: "false", VITE_SHOW_POUW: "false" });
    run("python3", [join(webRoot, "scripts/sync-operations.py"), "--check"]);
    return;
  }
  if (command === "test-api") {
    run(process.execPath, [join(webRoot, "scripts/check-api.mjs")], { ...process.env, HASURA_URL: args[0] || process.env.HASURA_URL || explorerUrl });
    return;
  }
  if (command === "doctor") {
    console.log(`Running kernel: ${release()}`);
    checkKernel();
    const info = capture("docker", ["info", "--format", "{{.ServerVersion}}"]);
    if (info.status === 0) console.log(`Kernel modules OK; Docker ${info.stdout.trim()} is accessible.`);
    else throw new Error("Kernel check passed, but Docker is unavailable or needs sudo. Run the launcher normally; it will request sudo if needed.");
    return;
  }
  if (!["up", "logs", "stop"].includes(command)) throw new Error(`Unknown command: ${command}. Run ${launcher} help`);
  if (command === "up") checkKernel();
  const docker = dockerCommand();
  if (command === "stop") return compose(docker, ["down"]);
  if (command === "logs") return compose(docker, ["logs", "--tail=100", "web", "hasura", "postgres", "mock-blocks"]);
  // Force live demo flags even if an old local .env enabled preview data.
  const env = { ...process.env, VITE_USE_MOCKS: "false", VITE_SHOW_POUW: "false" };
  compose(docker, ["up", "-d", "--build", "--wait", "--wait-timeout", "120", "web", "hasura", "postgres"], env);
  console.log("Waiting for the explorer API and Hasura metadata…");
  await waitForApi();
  run(process.execPath, [join(webRoot, "scripts/check-api.mjs")], { ...process.env, HASURA_URL: explorerUrl });
  compose(docker, ["up", "-d", "mock-blocks"], env);
  console.log(`\nExplorer ready: ${explorerUrl}\nThe upstream mock-blocks service is running (interval: MOCK_BLOCK_INTERVAL, default five seconds).\nStop: ${launcher} stop`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  });
}
