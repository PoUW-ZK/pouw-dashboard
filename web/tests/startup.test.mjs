import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { kernelIssue, composeArgs, repoRoot } from "../../scripts/dev.mjs";

const launcher = join(repoRoot, "dev.sh");
const devEntry = fileURLToPath(new URL("../scripts/start-dev.mjs", import.meta.url));
const apiEntry = fileURLToPath(new URL("../scripts/check-api.mjs", import.meta.url));

function outsideRepo(callback) {
  const directory = mkdtempSync(join(tmpdir(), "pouw-startup-test-"));
  try { return callback(directory); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

const missingModule = { running: "7.3.4-arch1-2", loaded: false, probeOk: false, modulesPresent: false, installed: ["7.3.5-arch1-1"] };

test("detects the reported Arch kernel upgrade before trying to start Docker", () => {
  const reason = kernelIssue(missingModule);
  assert.match(reason, /7\.3\.4-arch1-2/);
  assert.match(reason, /7\.3\.5-arch1-1/);
  assert.match(reason, /reboot/);
});

test("allows Docker if veth is already loaded or the running module is available", () => {
  assert.equal(kernelIssue({ ...missingModule, loaded: true }), undefined);
  assert.equal(kernelIssue({ ...missingModule, modulesPresent: true, probeOk: true }), undefined);
});

test("distinguishes a missing module from a pending kernel reboot", () => {
  const reason = kernelIssue({ ...missingModule, modulesPresent: true });
  assert.match(reason, /modprobe veth/);
  assert.doesNotMatch(reason, /reboot/);
});

test("Compose always receives the repository and configuration paths explicitly", () => {
  const args = composeArgs(["up", "-d"]);
  assert.equal(args[args.indexOf("--project-directory") + 1], repoRoot);
  assert.equal(args[args.indexOf("-f") + 1], join(repoRoot, "compose.yml"));
  assert.equal(args[args.indexOf("-p") + 1], "dashboard-check");
});

test("launcher help works from a directory outside the checkout", () => outsideRepo((directory) => {
  const result = spawnSync("bash", [launcher, "help"], { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /preview/);
  assert.match(result.stdout, /test-api/);
}));

for (const command of ["logs", "stop"]) {
  test(`launcher handles Docker's sudo requirement for ${command} without relying on cwd`, () => outsideRepo((directory) => {
    const bin = join(directory, "bin");
    mkdirSync(bin);
    // Stub both executables: this test never invokes real sudo or Docker.
    writeFileSync(join(bin, "docker"), '#!/bin/sh\necho "permission denied while connecting to Docker" >&2\nexit 1\n', { mode: 0o755 });
    writeFileSync(join(bin, "sudo"), '#!/bin/sh\nprintf "%s\\n" "$@" > "$POUW_TEST_COMMAND_LOG"\n', { mode: 0o755 });
    const log = join(directory, "args.txt");
    const result = spawnSync("bash", [launcher, command], {
      cwd: directory, encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, POUW_TEST_COMMAND_LOG: log },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /requires sudo/);
    const args = readFileSync(log, "utf8").trim().split("\n");
    assert.ok(args.includes(join(repoRoot, "compose.yml")));
    assert.ok(args.includes(repoRoot));
    assert.ok(args.includes(command === "stop" ? "down" : "logs"));
    assert.ok(args[0].includes("--preserve-env=VITE_USE_MOCKS,VITE_SHOW_POUW"));
    assert.ok(!args.includes("-v") && !args.includes("--volumes"));
  }));
}

const noApi = `globalThis.fetch = async () => { throw new TypeError("fetch failed", { cause: Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" }) }); };\n`;

test("live npm dev fails once with a useful instruction when Hasura is down", () => outsideRepo((directory) => {
  const preload = join(directory, "no-api.mjs");
  writeFileSync(preload, noApi);
  const result = spawnSync(process.execPath, ["--import", preload, devEntry], {
    cwd: directory, encoding: "utf8", env: { ...process.env, VITE_USE_MOCKS: "false" },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Hasura is not running/);
  assert.ok(result.stderr.includes(launcher));
  assert.doesNotMatch(result.stderr, /ws proxy error|AggregateError/);
}));

test("preview launches Vite with sample data without checking a backend", () => outsideRepo((directory) => {
  const preload = join(directory, "preview-process.mjs");
  writeFileSync(preload, `${noApi}
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
childProcess.spawnSync = (_command, args, options) => {
  console.log(JSON.stringify({ args, cwd: options.cwd, mocks: options.env.VITE_USE_MOCKS }));
  return { status: 0 };
};
syncBuiltinESMExports();
`);
  const result = spawnSync(process.execPath, ["--import", preload, devEntry], {
    cwd: directory, encoding: "utf8", env: { ...process.env, VITE_USE_MOCKS: "true" },
  });
  assert.equal(result.status, 0, result.stderr);
  const launch = JSON.parse(result.stdout.trim());
  assert.equal(launch.mocks, "true");
  assert.equal(launch.cwd.replace(/\/$/, ""), join(repoRoot, "web"));
  assert.ok(launch.args[0].endsWith("/vite/bin/vite.js"));
}));

test("API check from outside the repo explains an unavailable backend without an ENOENT or stack trace", () => outsideRepo((directory) => {
  const preload = join(directory, "no-api.mjs");
  writeFileSync(preload, noApi);
  const result = spawnSync(process.execPath, ["--import", preload, apiEntry], { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Explorer API check failed/);
  assert.match(result.stderr, /ECONNREFUSED/);
  assert.ok(result.stderr.includes(launcher));
  assert.doesNotMatch(result.stderr, /ENOENT|at main|at async/);
}));
