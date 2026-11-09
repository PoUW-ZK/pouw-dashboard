# PoUW Explorer frontend

React + Vite + TypeScript, with React Router for navigation and TanStack Query for request caching and refresh.

## Development

Run `npm ci`, then `npm run dev` from this directory. The Vite server proxies `/v1/graphql` to Hasura at `http://localhost:8081`. Start the local backend with Docker Compose from the repository root, as described in the root README.

`npm run build` checks TypeScript and creates the production bundle in `dist/`. `npm run lint` runs the existing frontend linter. Production nginx supports direct navigation to every frontend route.

## Structure

- `app/router.tsx`: routes and the shared app layout.
- `components/layout/`: branding, navigation, and page container.
- `components/ui/`: statistic cards, feedback states, links, pagination, and section headings.
- `features/`: dashboard and block API hooks and domain components; search form.
- `pages/`: home, block and circuit lists, mining, search, details, and not-found views.
- `lib/`: the existing anonymous Hasura client, query cache, formatting, and URL pagination.

The wireframe preview uses deterministic mock data by default, including dashboard statistics, blocks, circuits, mining, search, and detail pages. Copy `.env.example` to `.env.local` and set `VITE_USE_MOCKS=false` to connect to the existing Hasura API. Restart Vite after changing this setting. Balance and mining rewards are preview-only fields; the live API displays a dash for these unavailable values. Queries refresh every 30 seconds. The blocks list uses a height cursor and shows 12 rows per page. Home previews four blocks. Circuit lists and address and circuit histories show 20 rows per page. A block’s transfers, registrations, and proofs have separate cursors. Miner shares display up to 100 rows, matching the anonymous API limit.

Search accepts block heights and complete prefixed identifiers: `blk:`, `tx:`, `proof:`, `circ:`, and `addr:`. A transaction lookup checks transfers, circuit registrations, and proof requests. Orphaned records remain accessible through their identifiers and show their canonical status.

“Useful work” uses the API's `useful_work` view: total constraints represented by canonical proofs. Average block interval covers the canonical chain. Coin transaction counts include transfers and circuit registrations.
