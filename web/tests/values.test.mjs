import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { testServer } from "./helpers.mjs";
let server, number, shorten, heightCursor, searchCandidates, mergeMiners, parseGraphQL;
before(async () => {
  server = await testServer();
  ({ parseGraphQL } = await server.ssrLoadModule("/src/lib/parseGraphQL.ts"));
  ({ number, shorten } = await server.ssrLoadModule("/src/lib/formatters.ts"));
  ({ heightCursor } = await server.ssrLoadModule("/src/lib/usePage.ts"));
  ({ searchCandidates } = await server.ssrLoadModule("/src/features/search/normalize.ts"));
  ({ mergeMiners } = await server.ssrLoadModule("/src/features/mining/shares.ts"));
});
after(async () => { await server?.close(); });

test("formats large integer and decimal strings without precision loss", () => {
  assert.equal(number("9007199254740993"), "9,007,199,254,740,993");
  assert.equal(number("9223372036854775807"), "9,223,372,036,854,775,807");
  assert.equal(number("9007199254740993.995"), "9,007,199,254,740,994");
  assert.equal(number("-9007199254740993.125"), "-9,007,199,254,740,993.13");
  assert.equal(number("0"), "0");
  assert.equal(number(null), "—");
  assert.equal(number(NaN), "—");
});

test("shortens a circuit hash without converting a 256-bit identifier to Number", () => {
  assert.equal(shorten(`circ:${"f".repeat(64)}`), "circ:f…ffff");
});

test("height cursors preserve exact values above 2^53 and include genesis", () => {
  assert.equal(heightCursor("9007199254740993"), "9007199254740993");
  assert.equal(heightCursor("1"), "1");
  assert.equal(heightCursor("0"), "0");
  assert.equal(heightCursor(), "9223372036854775807");
  assert.equal(heightCursor("invalid"), "9223372036854775807");
});

test("search accepts raw hashes, 0x hashes, full identifiers and block zero", () => {
  const hex = "AB".repeat(32);
  assert.deepEqual(searchCandidates(`  0x${hex}  `), ["blk:", "tx:", "addr:"].map((prefix) => prefix + hex.toLowerCase()));
  assert.equal(searchCandidates(`BLK:${hex}`)[0], `blk:${hex.toLowerCase()}`);
  assert.equal(searchCandidates("0")[0], "0");
  assert.equal(searchCandidates(hex, true).length, 5);
});

test("miner labels keep observed values, unconfigured miners and zero-block nodes", () => {
  const rows = mergeMiners([
    { miner: "a", blocks: "9007199254740993", share: "0.75", last_block_height: "9007199254740999" },
    { miner: "other", blocks: "1", share: "0.25", last_block_height: "0" },
  ], [{ label: "Node 1", miner: "a" }, { label: "Node 2", miner: "b" }, { label: "Node 3", miner: "c" }]);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].blocks, "9007199254740993");
  assert.equal(rows[1].last_block_height, null);
  assert.equal(rows[2].blocks, 0);
  assert.equal(rows[3].miner, "other");
});


test("decodes unsafe JSON integer tokens before JavaScript can round them", () => {
  const result = parseGraphQL('{"height":9007199254740993,"fee":-9223372036854775807,"ratio":1.25,"id":"9007199254740993","escaped":"\\\"9007199254740993","zero":0}');
  assert.equal(result.height, "9007199254740993");
  assert.equal(result.fee, "-9223372036854775807");
  assert.equal(result.ratio, 1.25);
  assert.equal(result.id, "9007199254740993");
  assert.equal(result.zero, 0);
});
