# Demo frontend — reconciliation and verification

Reconciled against `main` at `a8b5ee9` after the stash-pop conflict.

## Existing upstream work reused

| Existing implementation | Upstream change | Resolution |
| --- | --- | --- |
| SQL block producer, including transfers/proofs | #103 (`01b8d78`) | Keep `hasura/mock/mock_blocks.sql` and profile `mock`; remove our second SQL producer. |
| Live cursor streams and database/WebSocket tests | #104 (`a449c95`) | Keep the upstream contract, helpers and tests unchanged. |
| Allow-list generation, permissions, CORS and tests | #105 (`1bc5b22`) | Keep the upstream generator and generated metadata; remove our second contract snapshot and allow-list implementation. |
| Allow-listed explorer E2E queries | #106 (`a8b5ee9`) | Keep upstream E2E checks unchanged. |

The seed, backend test fixtures/expectations and Hasura Dockerfile are restored
to upstream too. No database contents, stash entries or other repositories were
changed by this reconciliation. A full backup of the conflicted working tree,
Git index/history, stash and untracked files was taken before editing.

## Remaining frontend contribution

- Browser `graphql-transport-ws` client with early ping/pong, heartbeats,
  reconnects, operation cleanup and connection feedback.
- Direct `HomeStats` and `LatestBlocks` subscriptions. Other screens use the
  existing HTTP contract and refresh on subscribed tip changes, including
  reorgs/reconnects. No timed frontend polling.
- Demo flag for proof/circuit screens, configured miner labels, raw/prefixed
  identifier searches, exact integer decoding/formatting and mobile containment.
- Frontend tests, an explorer-proxy smoke check and the optional local launcher.

Frontend documents in `web/src/graphql/operations.json` are an unchanged export
of the upstream `web-api` allow-list, not a second API definition. Update/check
that export after the upstream generator runs:

```bash
python3 web/scripts/sync-operations.py
python3 web/scripts/sync-operations.py --check
```

This script uses PyYAML from `hasura/tests/requirements.txt`. Normal frontend
builds use the committed JSON. CI checks the export after installing those
existing requirements. The upstream allow-list remains exactly contract-only.

## Run locally

From any directory in this checkout:

```bash
/home/leonard/shit/pouw/pouw-dashboard/dev.sh
```

Run as your regular user; the launcher requests sudo for Docker when needed.
It rebuilds the explorer/Hasura, verifies HTTP and WebSocket traffic through
localhost:8080, then starts the existing upstream `mock-blocks` service.
`MOCK_BLOCK_INTERVAL` controls its interval (default five seconds). The mock
selects existing seed miners and adds transfers/proofs; it does not run real nodes.

```bash
/home/leonard/shit/pouw/pouw-dashboard/dev.sh check
/home/leonard/shit/pouw/pouw-dashboard/dev.sh test-api
/home/leonard/shit/pouw/pouw-dashboard/dev.sh logs
/home/leonard/shit/pouw/pouw-dashboard/dev.sh stop
```

The launcher keeps project name `dashboard-check` and preserves its database.
`dev.sh preview` serves static frontend sample data on localhost:5173 without
Docker. Plain `npm run dev` checks Hasura before starting the live Vite proxy.
The loopback CORS origins include both localhost and 127.0.0.1 for these pages.

## Contract boundary and verification

The upstream block-detail operations have no nested paging variables and expose
at most 100 rows per child list. The frontend pages that returned result locally
and labels the transfer limit when reached. Complete paging beyond 100 entries
would need an agreed extension to the shared contract; this change does not add
unregistered operations or claim those extra rows were fetched.

Automated frontend checks cover exact allow-list documents, cache refresh on
chain changes, genesis/empty states, block-entry paging, orphaned records, address
history, configured miners, demo routes, transport recovery and numeric precision.
The upstream backend/allow-list/live-stream suites remain intact; run them as
documented in README against a fresh fixed-seed stack with its producer stopped.

Still verify on real staging: new-block latency, all three actual miner reward
keys, long address histories, mobile/desktop browser layout, reconnect/reorg
behavior and a one-hour session. The proxy smoke check is intentionally small;
the upstream Python suites own full backend contract/security/stream coverage.
