# pouw-dashboard
Web dashboard and block explorer

## Structure

| Directory     | What                                                                                                                                       | Image                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `web/`        | Explorer UI (React, Vite). `npm ci`, `npm run lint`, `npm test`, `npm run build`                                                           | `ghcr.io/pouw-zk/pouw-dashboard` (nginx on port 8080) |
| `hasura/`     | GraphQL API of the explorer: `metadata/` (tracked views, relationships, permissions), `seeds/default/*.sql` (schema, API views, fake data) | `ghcr.io/pouw-zk/pouw-dashboard-hasura`               |
| `e2e/`        | Tests against the running network, called from pouw-deploy                                                                                 | -                                                     |
| `compose.yml` | Local development: Postgres with the seed and Hasura                                                                                       | -                                                     |

The API contract (types, fields, operations) is
[contracts/web-api.md](https://github.com/PoUW-ZK/pouw-docs/blob/main/contracts/web-api.md)
and [web-api.graphql](https://github.com/PoUW-ZK/pouw-docs/blob/main/contracts/web-api.graphql)
in pouw-docs. The reasons for the setup are in
[ADR-0009](https://github.com/PoUW-ZK/pouw-docs/blob/main/decisions/0009-explorer-v0-scope.md).

## How the API works

The database schema is owned by
[pouw-indexer](https://github.com/PoUW-ZK/pouw-indexer) (SQL migrations in its
`migrations/`, run by the indexer on start). Hasura only tracks it. That is why
`hasura/` has no `migrations/`.

Hasura does not track the indexer's tables. It tracks only **views in the
schema `api`**, and those views are the API:

- A view is a saved `SELECT` over the indexer's tables. It holds no data, and
  Hasura queries it like a table.
- The views turn raw bytes into ids such as `blk:48ff…`, rename columns, add
  totals (`transfer_count`, `fee_total`, `useful_work`) and a `sort_key` for
  paging.
- When the indexer schema changes, only the views change. The GraphQL schema,
  the contract and the frontend stay the same. Postgres refuses to drop a
  column that a view uses, so such a change needs the views updated with it.
- The role `anonymous` (every request without a token) can only select from
  the views, at most 100 rows per list. There are no mutations.

The views can not be Hasura migrations, because the Hasura image applies the
metadata before its migrations, and the metadata refers to the views. So they
are a migration of pouw-indexer (`migrations/0002_api_views.sql`): the indexer
creates the tables and the views on start, everywhere the network runs, and
Hasura starts after it.

The local `compose.yml` has no indexer, so the seeds stand in for its
migrations. CI applies the real migrations of pouw-indexer instead of the
first two seeds, so a seed that drifts from them shows up there.

| File in `hasura/seeds/default/` | What                                                                  |
| ------------------------------- | --------------------------------------------------------------------- |
| `00_schema.sql`                 | Copy of `pouw-indexer/migrations/0001_schema_v0.sql` (local only)     |
| `05_api_views.sql`              | Copy of `pouw-indexer/migrations/0002_api_views.sql` (local only)     |
| `10_seed.sql`                   | Fake data: one small chain, see below                                 |

A change of the views is a new migration in pouw-indexer (an applied
migration never changes), plus the same change in `05_api_views.sql` and,
if needed, `metadata/`. Open the two pull requests together.

## Run locally

Needs Docker with Compose.

```bash
docker compose up -d --build   # dashboard, Postgres with seed, and Hasura
docker compose ps
```

| What            | Where                                               |
| --------------- | --------------------------------------------------- |
| Dashboard       | <http://localhost:8080>                             |
| GraphQL queries | `http://localhost:8081/v1/graphql`                  |
| Subscriptions   | `ws://localhost:8081/v1/graphql`                    |
| Console         | <http://localhost:8081/console>, admin secret `dev` |
| Postgres        | `postgres://pouw:pouw@localhost:5433/pouw`          |
| Health          | `http://localhost:8081/healthz`                     |

The frontend sends no secret and runs as `anonymous`, like in production. In
the console, untick the `x-hasura-admin-secret` header in the API tab to see
the same. The dashboard proxies `/v1/graphql` to Hasura, so browser requests use
the same-origin route and do not expose the admin secret.

Stop with `docker compose stop`. `docker compose down -v` also deletes the
database, and the next `up` starts from the seed again.

### Fake data

`10_seed.sql` is one consistent chain: blocks 0 to 3, a competing block at
height 3 that lost (orphaned), two circuits (Groth16 and PLONK), transfers and
proof transactions that refer to each other. Ids are the SHA-256 of a readable
label, so they never change. Some to try in the console:

| Label                       | Id                                                                       |
| --------------------------- | ------------------------------------------------------------------------ |
| block 2                     | `blk:48ff03c8534de9a066b8ebb89e2490aef7b298902e93f3f471d851b124cb4ce4`   |
| transfer in blocks 3 and 3b | `tx:f92c43d3978af155ba8db14448f1d35428b00a6d79ca62d937e50bb0848d016f`    |
| proof request               | `tx:9456bdfa12ea76959c94a3572f5d91c73d838622df0a8d9b4e815c276c6b7880`    |
| proof                       | `proof:4887ab0778651ae99cd9ee6a36ecfdd4df22adb95cd55ec5b39764afd29403ae` |
| Groth16 circuit             | `circ:dde9d7fd1e611e1d1a3a38530b6da0be510b1587ce5d75a5e1186b3bab8d8f10`  |
| client                      | `addr:a01d5b24c16f3eab6f8fe00d23bf955ecdd9e5d324e2267b99ffaec8b8ef9c6e`  |
| miner                       | `addr:0a859756420649d1caffb67471544d345283cfdce8a28203d9d97b0c5acb60c3`  |

The seed runs only on a fresh database. After changing it, run
`docker compose down -v && docker compose up -d --build`. For a quick test
without a reset, insert rows with `psql`; a running subscription such as
`LatestBlocks` shows a new block within a second.

## Changing the API

**A view** (new field, follow a schema change): edit `05_api_views.sql`, then
reset the database as above. Adding a column at the end of a view keeps the
contract. Removing or renaming a field changes it, and needs a pull request in
pouw-docs together with the frontend.

**Metadata** (tracking, relationships, permissions): the files in
`hasura/metadata/` are the source, commit every change there. Two ways to
change them, both with the Hasura CLI in the same version as the image (see
`hasura/Dockerfile`):

```bash
export HASURA_GRAPHQL_ADMIN_SECRET=dev

# 1. in the CLI console, which writes every change into hasura/metadata/
hasura console --project hasura          # endpoint from hasura/config.yaml
hasura metadata export --project hasura  # to be sure, then commit hasura/metadata

# 2. or edit the YAML files and apply them
hasura metadata apply --project hasura
hasura metadata inconsistency list --project hasura   # must print nothing
```

The console at `localhost:8081/console` is for browsing and trying queries.
Changes clicked there live only in the running database until exported.

## CI

The `hasura` job in `.github/workflows/ci.yml` repeats a clean local start on
every pull request: an empty Postgres, the migrations of pouw-indexer `main`,
the seeds in name order (without those the migrations already cover), then the
Hasura image. It fails when a view does not match the schema, or when the
metadata refers to a view or column that does not exist.

The whole network (indexer, Hasura with this metadata, explorer) with your
local changes: `make dev` in pouw-deploy next to this clone.
