import assert from "node:assert/strict";
import { test } from "node:test";
import { testServer } from "./helpers.mjs";

test("anonymous HTTP queries preserve large amounts and use the same-origin API", async (t) => {
  const server = await testServer(false, false);
  try {
    const { hasuraQuery } = await server.ssrLoadModule("/src/lib/hasura.ts");
    t.mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url, "/v1/graphql");
      assert.deepEqual(options.headers, { "Content-Type": "application/json" });
      assert.deepEqual(JSON.parse(options.body).variables, { id: "tx:test" });
      return { ok: true, text: async () => '{"data":{"transfers":[{"amount":9223372036854775807}]}}' };
    });
    const result = await hasuraQuery("query Test($id: String!) { transfers { amount } }", { id: "tx:test" });
    assert.equal(result.transfers[0].amount, "9223372036854775807");
  } finally { await server.close(); }
});

test("HTTP GraphQL validation and allow-list errors remain actionable", async (t) => {
  const server = await testServer(false, false);
  try {
    const { hasuraQuery } = await server.ssrLoadModule("/src/lib/hasura.ts");
    t.mock.method(globalThis, "fetch", async () => ({ ok: true, text: async () => '{"errors":[{"message":"query is not in any of the allow-lists"}]}' }));
    await assert.rejects(hasuraQuery("query Test { stats { indexed_height } }"), /allow-lists/);
  } finally { await server.close(); }
});
