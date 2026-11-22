import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { readFile } from "node:fs/promises";
import { testServer } from "./helpers.mjs";

let server, routes, mockQuery;
const operations = JSON.parse(await readFile(new URL("../src/graphql/operations.json", import.meta.url)));
before(async () => {
  server = await testServer();
  ({ routes } = await server.ssrLoadModule("/src/app/routes.tsx"));
  ({ mockQuery } = await server.ssrLoadModule("/src/mocks.ts"));
});
after(async () => { await server?.close(); });
const key = (name, variables = {}) => ["explorer", name, variables];
function fixture() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  function prime(name, variables = {}, data = mockQuery(operations.queries[name], variables)) {
    client.setQueryData(key(name, variables), data);
    return data;
  }
  function render(path) {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    try {
      return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(RouterProvider, { router })));
    } finally { router.dispose(); }
  }
  return { client, prime, render };
}

test("overview renders a new genesis at height zero without proof or circuit links", () => {
  const { prime, render } = fixture();
  prime("HomeStats", {}, { stats: [{ indexed_height: "0", block_count: "1", transfer_count: "0", latest_block_time: null, avg_block_interval_s: null }] });
  const data = prime("LatestBlocks", { limit: 5 });
  prime("LatestBlocks", { limit: 5 }, { blocks: [{ ...data.blocks[0], height: "0", transfer_count: "0" }] });
  const html = render("/");
  assert.match(html, /Indexed height/);
  assert.match(html, /#0/);
  assert.match(html, /Waiting for more blocks/);
  assert.doesNotMatch(html, /href="\/(circuits|proof)/);
  assert.doesNotMatch(html, /Processed proofs|Registered circuits|Proof transactions/);
});

test("an empty chain has a meaningful block empty state", () => {
  const { prime, render } = fixture();
  prime("HomeStats", {}, { stats: [{ indexed_height: null, block_count: "0", transfer_count: "0", latest_block_time: null, avg_block_interval_s: null }] });
  prime("LatestBlocks", { limit: 5 }, { blocks: [] });
  const html = render("/");
  assert.match(html, /No blocks found/);
  assert.match(html, /Waiting for the first block/);
  assert.doesNotMatch(html, /NaN|undefined/);
});

test("a changed subscription snapshot replaces the visible tip, including a reorg", async () => {
  const { prime, render, client } = fixture();
  prime("HomeStats");
  const initial = prime("LatestBlocks", { limit: 5 });
  assert.match(render("/"), /#12,567/);
  const { HasuraSocket } = await server.ssrLoadModule("/src/lib/subscriptions.ts");
  const socket = { readyState: 1, send() {}, close() {} };
  const connection = new HasuraSocket("ws://test/v1/graphql", () => socket);
  const dispose = connection.subscribe(operations.subscriptions.LatestBlocks, { limit: 5 }, {
    next: (data) => client.setQueryData(key("LatestBlocks", { limit: 5 }), data),
    error: (error) => { throw error; },
  });
  socket.onopen();
  socket.onmessage({ data: JSON.stringify({ type: "connection_ack" }) });
  for (const height of [12568, 12566]) {
    socket.onmessage({ data: JSON.stringify({ id: "1", type: "next", payload: { data: { blocks: [{ ...initial.blocks[0], height }] } } }) });
    const html = render("/");
    assert.match(html, new RegExp(`#${height.toLocaleString("en-US")}`));
    assert.doesNotMatch(html, /#12,567/);
  }
  dispose();
});

test("mining keeps all three real node labels and shows zero wins honestly", () => {
  const { prime, render } = fixture();
  prime("HomeStats");
  prime("Mining", {}, { stats: [{ block_count: "0", avg_block_interval_s: null }], useful_work: [], miner_shares: [] });
  const html = render("/mining");
  for (const node of ["Node 1", "Node 2", "Node 3"]) assert.match(html, new RegExp(node));
  assert.equal((html.match(/0%/g) ?? []).length, 3);
  assert.doesNotMatch(html, /Useful work/);
});

test("block details show transfers, orphan status and exact fees without PoUW sections", () => {
  const { prime, render } = fixture();
  const id = `blk:${(20000).toString(16).padStart(64, "0")}`;
  const variables = { hash: id };
  const data = mockQuery(operations.queries.BlockByHash, variables);
  data.blocks[0].fee_total = "9007199254740993";
  prime("BlockByHash", variables, data);
  const html = render(`/blocks/${encodeURIComponent(id)}`);
  assert.match(html, /Orphaned/);
  assert.match(html, /Coin transfers/);
  assert.match(html, /href="\/transactions\//);
  assert.match(html, /9,007,199,254,740,993/);
  assert.doesNotMatch(html, /Circuit registrations|Proof transactions|href="\/circuits/);
});

test("transaction details retain both canonical and orphaned occurrences", () => {
  const { prime, render } = fixture();
  const id = `tx:${(100).toString(16).padStart(64, "0")}`;
  prime("Transaction", { txid: id });
  const html = render(`/transactions/${id}`);
  assert.match(html, /Canonical/);
  assert.match(html, /Orphaned/);
  assert.match(html, /Coin transfer/);
  assert.doesNotMatch(html, /sort key/);
});

test("address history uses an exact cursor, a scroll container and no proof navigation", () => {
  const { prime, render } = fixture();
  const id = "addr:8a88e3dd7409f195fd52db2d3cba5d72ca6709bf1d94121bf3748801b40f6f5c";
  prime("Address", { address: id });
  prime("AddressTxs", { address: id, before: "~", limit: 21, filter: { kind: { _eq: "transfer" } } });
  prime("MinedBlocks", { miner: id, before: "9223372036854775807", limit: 21 });
  const html = render(`/addresses/${id}`);
  assert.match(html, /Transaction history/);
  assert.match(html, /table-scroll/);
  assert.match(html, /Next/);
  assert.doesNotMatch(html, /Proof requests answered|href="\/proof/);
});

test("circuits and proof URLs resolve to the unavailable-page screen in demo mode", () => {
  const { render } = fixture();
  for (const path of ["/circuits", "/circuits/circ:123", "/proof/proof:123", "/tx/proof/proof:123", "/transactions/proof:123"]) {
    const html = render(path);
    assert.match(html, /Page not found/);
    assert.doesNotMatch(html, /Registered circuits|Proof transaction details/);
  }
});

test("development mode can opt back into PoUW screens", async () => {
  const dev = await testServer(true);
  try {
    const { routes: devRoutes } = await dev.ssrLoadModule("/src/app/routes.tsx");
    assert.ok(devRoutes[0].children.some((route) => route.path === "/circuits"));
    assert.ok(devRoutes[0].children.some((route) => route.path === "/proof/:id"));
  } finally { await dev.close(); }
});

test("block transfers page through the contract response without extra GraphQL cursor operations", () => {
  const { prime, render } = fixture();
  const id = `blk:${(12567).toString(16).padStart(64, "0")}`;
  const data = prime("BlockByHash", { hash: id });
  const first = data.blocks[0].transfers[0].txid;
  const seventh = data.blocks[0].transfers[6].txid;
  const initial = render(`/blocks/${id}`);
  const next = render(`/blocks/${id}?transferPage=2`);
  assert.ok(initial.includes(`href="/transactions/${encodeURIComponent(first)}"`));
  assert.ok(!initial.includes(`href="/transactions/${encodeURIComponent(seventh)}"`));
  assert.ok(next.includes(`href="/transactions/${encodeURIComponent(seventh)}"`));
  assert.ok(!next.includes(`href="/transactions/${encodeURIComponent(first)}"`));
  assert.match(next, /Page 2/);
});
