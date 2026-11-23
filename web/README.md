# PoUW Explorer frontend

React + Vite + TypeScript, with React Router for navigation, TanStack Query for caching and Hasura subscriptions for live updates.

## Development

The simplest startup is `../dev.sh` for the complete Docker stack, or
`../dev.sh preview` for static frontend sample data without Docker. You can
invoke the launcher by its absolute path from any directory.

For frontend development against an existing backend, run `npm ci`, then
`npm run dev` from this directory. The Vite server proxies `/v1/graphql` to
Hasura at `http://127.0.0.1:8081`. The dev command checks Hasura first and
prints the startup/preview commands if it is unavailable. Live mode does not
silently switch to preview data.

`npm run build` checks TypeScript and creates the production bundle in `dist/`. `npm run lint` runs the existing frontend linter. Production nginx supports direct navigation to every frontend route.

## Structure

- `app/router.tsx`: routes and the shared app layout.
- `components/layout/`: branding, navigation, and page container.
- `components/ui/`: statistic cards, feedback states, links, pagination, and section headings.
- `features/`: dashboard and block API hooks and domain components; search form.
- `pages/`: home, block and circuit lists, mining, search, details, and not-found views.
- `lib/`: the existing anonymous Hasura client, query cache, formatting, and URL pagination.

Production builds always connect to Hasura. During development, `VITE_USE_MOCKS=true` selects
deterministic frontend sample data, and `VITE_SHOW_POUW=true` enables optional
proof/circuit screens. Restart Vite after changing these settings. Home and latest blocks use the contract’s subscriptions. Other screens
use its HTTP documents and refresh when the subscribed chain tip changes;
there is no periodic polling. Balance and mining rewards
are preview-only fields; the current live API displays a dash for unavailable
values. Blocks use height cursors with 12 rows per page, and Home shows four
blocks. Address/circuit histories show 20 rows per page. Each block's transfer,
registration and proof lists are paged locally within the contract's
100-row-per-list limit. Miner shares show up to
100 indexed miners, with the three configured demo nodes always labeled.

Search accepts block heights, raw/0x hashes and prefixed `blk:`, `tx:` and
`addr:` identifiers. Optional PoUW mode also supports `proof:` and `circ:`.
Orphaned records remain accessible through their identifiers and show their
canonical status.

“Useful work” uses the API's `useful_work` view: total constraints represented by canonical proofs. Average block interval covers the canonical chain. Coin transaction counts include transfers and circuit registrations.


## Shared API contract

The frontend documents in `src/graphql/operations.json` are exported unchanged
from the existing Hasura `web-api` allow-list. They introduce no new backend
operations. After the upstream contract/allow-list changes, run from the repo root:

```bash
python3 web/scripts/sync-operations.py
```

The script uses PyYAML from the existing Hasura test requirements. CI checks
that the exported documents match. The backend generator remains
`hasura/allowlist.py`; its query, permissions and live-stream tests are unchanged.
