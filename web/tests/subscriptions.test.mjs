import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { testServer } from "./helpers.mjs";

let server, HasuraSocket, websocketUrl;
before(async () => {
  server = await testServer();
  ({ HasuraSocket, websocketUrl } = await server.ssrLoadModule("/src/lib/subscriptions.ts"));
});
after(async () => { await server?.close(); });

class Socket {
  readyState = 0;
  sent = [];
  send(value) { this.sent.push(JSON.parse(value)); }
  open() { this.readyState = 1; this.onopen?.(); }
  receive(value) { this.onmessage?.({ data: JSON.stringify(value) }); }
  close(code = 1000, reason = "") {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}
function fixture() {
  const sockets = [];
  const client = new HasuraSocket("wss://explorer.test/v1/graphql", (url, protocol) => {
    assert.equal(url, "wss://explorer.test/v1/graphql");
    assert.equal(protocol, "graphql-transport-ws");
    const socket = new Socket();
    sockets.push(socket);
    return socket;
  });
  const values = [], errors = [];
  const sink = { next: (value) => values.push(value), error: (error) => errors.push(error.message) };
  return { client, sockets, values, errors, sink };
}

test("uses the same host, HTTPS security and GraphQL path", () => {
  assert.equal(websocketUrl({ protocol: "https:", host: "explorer.test:8443" }), "wss://explorer.test:8443/v1/graphql");
  assert.equal(websocketUrl({ protocol: "http:", host: "localhost:8080" }), "ws://localhost:8080/v1/graphql");
});

test("answers Hasura ping before ack and waits for ack before subscribing", () => {
  const { client, sockets, sink } = fixture();
  const dispose = client.subscribe("subscription LatestBlocks { blocks { hash } }", { limit: 4 }, sink);
  const socket = sockets[0];
  socket.open();
  socket.receive({ type: "ping", payload: { nonce: 7 } });
  assert.deepEqual(socket.sent, [{ type: "connection_init", payload: {} }, { type: "pong", payload: { nonce: 7 } }]);
  socket.receive({ type: "connection_ack" });
  assert.equal(socket.sent[2].type, "subscribe");
  assert.deepEqual(socket.sent[2].payload.variables, { limit: 4 });
  socket.receive({ type: "ping" });
  assert.deepEqual(socket.sent.at(-1), { type: "pong" });
  dispose();
});

test("multiplexes operations, pushes replacement snapshots and disposes without leaking", () => {
  const { client, sockets, sink, values } = fixture();
  const dispose = client.subscribe("subscription LatestBlocks { blocks { hash } }", {}, sink);
  sockets[0].open();
  sockets[0].receive({ type: "connection_ack" });
  const second = client.subscribe("subscription HomeStats { stats { indexed_height } }", {}, sink);
  assert.equal(sockets.length, 1);
  const operations = sockets[0].sent.filter((message) => message.type === "subscribe");
  assert.equal(operations.length, 2);
  for (const hash of ["old-tip", "new-tip", "reorg-tip"]) sockets[0].receive({ id: operations[0].id, type: "next", payload: { data: { blocks: [{ hash }] } } });
  assert.equal(values.length, 3);
  assert.deepEqual(values[2], { blocks: [{ hash: "reorg-tip" }] });
  dispose();
  assert.equal(sockets[0].sent.at(-1).type, "complete");
  assert.equal(sockets[0].readyState, 1);
  sockets[0].receive({ id: operations[0].id, type: "next", payload: { data: { blocks: [] } } });
  assert.equal(values.length, 3);
  second();
  assert.equal(sockets[0].readyState, 3);
  assert.equal(client.getStatus(), "idle");
});

test("reconnects after a network failure and resubscribes only active operations", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const { client, sockets, sink, values } = fixture();
  const dispose = client.subscribe("subscription LatestBlocks { blocks { hash } }", {}, sink);
  sockets[0].open();
  sockets[0].receive({ type: "connection_ack" });
  const removed = client.subscribe("subscription HomeStats { stats { indexed_height } }", {}, sink);
  removed();
  sockets[0].close(1006, "offline");
  assert.equal(client.getStatus(), "reconnecting");
  t.mock.timers.tick(1000);
  assert.equal(sockets.length, 2);
  sockets[1].open();
  sockets[1].receive({ type: "ping" });
  sockets[1].receive({ type: "connection_ack" });
  const operations = sockets[1].sent.filter((message) => message.type === "subscribe");
  assert.equal(operations.length, 1);
  sockets[1].receive({ id: operations[0].id, type: "next", payload: { data: { blocks: [{ hash: "latest" }] } } });
  assert.equal(values[0].blocks[0].hash, "latest");
  dispose();
  t.mock.timers.tick(60_000);
  assert.equal(sockets.length, 2);
});

test("reports GraphQL allow-list errors and terminates a failed operation", () => {
  const { client, sockets, sink, errors } = fixture();
  const dispose = client.subscribe("subscription Missing { stats { indexed_height } }", {}, sink);
  sockets[0].open();
  sockets[0].receive({ type: "connection_ack" });
  const id = sockets[0].sent.at(-1).id;
  sockets[0].receive({ id, type: "error", payload: [{ message: "query is not in any of the allow-lists" }] });
  assert.match(errors[0], /allow-lists/);
  assert.equal(sockets[0].readyState, 3);
  dispose();
});

test("does not retry a forbidden connection forever", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const { client, sockets, sink, errors } = fixture();
  client.subscribe("subscription HomeStats { stats { indexed_height } }", {}, sink);
  sockets[0].open();
  sockets[0].close(4403, "Forbidden");
  assert.equal(client.getStatus(), "error");
  assert.match(errors[0], /4403/);
  t.mock.timers.tick(60_000);
  assert.equal(sockets.length, 1);
});

test("times out an unacknowledged connection, even if ping arrived", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const { client, sockets, sink } = fixture();
  const dispose = client.subscribe("subscription HomeStats { stats { indexed_height } }", {}, sink);
  sockets[0].open();
  sockets[0].receive({ type: "ping" });
  t.mock.timers.tick(10_000);
  assert.equal(client.getStatus(), "reconnecting");
  t.mock.timers.tick(1000);
  assert.equal(sockets.length, 2);
  dispose();
});

test("detects a lost heartbeat and reconnects", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const { client, sockets, sink } = fixture();
  const dispose = client.subscribe("subscription HomeStats { stats { indexed_height } }", {}, sink);
  sockets[0].open();
  sockets[0].receive({ type: "connection_ack" });
  t.mock.timers.tick(20_000);
  assert.equal(sockets[0].sent.at(-1).type, "ping");
  sockets[0].receive({ type: "pong" });
  t.mock.timers.tick(20_000);
  assert.equal(client.getStatus(), "connected");
  t.mock.timers.tick(10_000);
  assert.equal(client.getStatus(), "reconnecting");
  dispose();
});
