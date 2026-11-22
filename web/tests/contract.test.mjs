import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, after, test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { testServer } from "./helpers.mjs";

let server, refreshReadQueries;
before(async () => {
  server = await testServer();
  ({ refreshReadQueries } = await server.ssrLoadModule("/src/lib/useChainUpdates.ts"));
});
after(async () => { await server?.close(); });

test("every frontend document is an unchanged member of the upstream Hasura allow-list", async () => {
  const source = await readFile(new URL("../../hasura/metadata/query_collections.yaml", import.meta.url), "utf8");
  const operations = JSON.parse(await readFile(new URL("../src/graphql/operations.json", import.meta.url), "utf8"));
  for (const [kind, documents] of Object.entries(operations)) {
    for (const [name, document] of Object.entries(documents)) {
      const yaml = document.trimEnd().split("\n").map((line) => ("          " + line).trimEnd()).join("\n");
      assert.ok(source.includes("        query: |\n" + yaml + "\n"), `${kind}.${name} must come from the upstream allow-list`);
    }
  }
  assert.deepEqual(Object.keys(operations.subscriptions).sort(), ["HomeStats", "LatestBlocks"]);
});

test("chain updates refresh HTTP details, addresses, mining and search while leaving direct subscriptions alone", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const names = ["BlockByHash", "Transaction", "Address", "AddressTxs", "Mining", "Search", "HomeStats", "LatestBlocks"];
  for (const name of names) client.setQueryData(["explorer", name, {}], { data: name });
  client.setQueryData(["unrelated"], true);
  await refreshReadQueries(client);
  for (const name of names) {
    assert.equal(client.getQueryState(["explorer", name, {}]).isInvalidated, !["HomeStats", "LatestBlocks"].includes(name), name);
  }
  assert.equal(client.getQueryState(["unrelated"]).isInvalidated, false);
  client.clear();
});
