// Small frontend-proxy smoke check. The upstream Python suite owns full
// contract, permissions and cursor-stream tests; do not duplicate it here.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

async function main() {
  const operations = JSON.parse(await readFile(new URL("../src/graphql/operations.json", import.meta.url)));
  const endpoint = new URL(process.env.HASURA_URL || "http://localhost:8080");
  endpoint.pathname = "/v1/graphql";
  endpoint.search = "";
  for (const name of ["HomeStats", "LatestBlocks"]) {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: operations.queries[name], variables: name === "LatestBlocks" ? { limit: 1 } : {} }),
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, 200, `HTTP ${response.status}`);
    const result = await response.json();
    assert.ok(!result.errors, `${name}: ${JSON.stringify(result.errors)}`);
    assert.ok(Array.isArray(result.data?.[name === "HomeStats" ? "stats" : "blocks"]), `${name}: missing snapshot`);
  }
  console.log("HTTP: frontend overview and latest-block contract documents passed through the explorer proxy.");
  endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint, "graphql-transport-ws");
    let finished = false;
    const timeout = setTimeout(() => finish(new Error("GraphQL WebSocket snapshot timed out")), 15_000);
    function finish(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ id: "latest", type: "complete" }));
      socket.close();
      if (error) reject(error);
      else resolve();
    }
    socket.onopen = () => socket.send(JSON.stringify({ type: "connection_init", payload: {} }));
    socket.onmessage = ({ data }) => {
      try {
        const message = JSON.parse(String(data));
        if (message.type === "ping") {
          socket.send(JSON.stringify({ type: "pong", ...(message.payload === undefined ? {} : { payload: message.payload }) }));
        } else if (message.type === "connection_ack") {
          socket.send(JSON.stringify({ id: "latest", type: "subscribe", payload: { query: operations.subscriptions.LatestBlocks, variables: { limit: 1 } } }));
        } else if (message.type === "error" || message.payload?.errors?.length) {
          finish(new Error(JSON.stringify(message.payload)));
        } else if (message.type === "next") {
          assert.ok(Array.isArray(message.payload?.data?.blocks), "Missing live block snapshot");
          finish();
        }
      } catch (error) { finish(error); }
    };
    socket.onerror = () => finish(new Error(`WebSocket failed at ${endpoint}`));
    socket.onclose = ({ code, reason }) => { if (!finished) finish(new Error(`WebSocket closed (${code}): ${reason}`)); };
  });
  console.log("WebSocket: latest blocks delivered through the explorer proxy.");
}

main().catch((error) => {
  const details = error.cause?.errors?.map((entry) => entry.code).filter(Boolean).join(", ") || error.cause?.code;
  console.error(`Explorer API check failed: ${error.message}${details ? ` (${details})` : ""}`);
  if (error instanceof TypeError) console.error(`Start the local stack with:\n  ${fileURLToPath(new URL("../../dev.sh", import.meta.url))}`);
  process.exitCode = 1;
});
