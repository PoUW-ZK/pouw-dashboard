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

Hasura serves GraphQL over the database of
[pouw-indexer](https://github.com/PoUW-ZK/pouw-indexer). It does not track the
indexer's tables. It tracks only **views in the schema `api`**, and those views
are the API:

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

The views are defined in `hasura/seeds/default/05_api_views.sql`. They are not
Hasura migrations, because the Hasura image applies the metadata before its
migrations, and the metadata refers to the views. Once pouw-indexer has
Alembic migrations, the views move there as one migration, and
`00_schema.sql` is deleted.

| File in `hasura/seeds/default/` | What                                                  |
| ------------------------------- | ----------------------------------------------------- |
| `00_schema.sql`                 | The indexer schema, until pouw-indexer has migrations |
| `05_api_views.sql`              | The `api` views and the `search` function             |
| `10_seed.sql`                   | Fake data: one small chain, see below                 |

## Run locally

Needs Docker with Compose.

```bash
docker compose up -d --build   # Postgres with the seed, then Hasura with metadata/
docker compose ps              # both Up, postgres (healthy)
```

| What            | Where                                               |
| --------------- | --------------------------------------------------- |
| GraphQL queries | `http://localhost:8081/v1/graphql`                  |
| Subscriptions   | `ws://localhost:8081/v1/graphql`                    |
| Console         | <http://localhost:8081/console>, admin secret `dev` |
| Postgres        | `postgres://pouw:pouw@localhost:5433/pouw`          |
| Health          | `http://localhost:8081/healthz`                     |

The frontend sends no secret and runs as `anonymous`, like in production. In
the console, untick the `x-hasura-admin-secret` header in the API tab to see
the same.

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

**Metadata** (tracking, relationships, permissions): edit the YAML files in
`hasura/metadata/` and apply them to the running Hasura:

```bash
export HASURA_GRAPHQL_ADMIN_SECRET=dev
hasura metadata apply --project hasura
hasura metadata inconsistency list --project hasura   # must print nothing
```

Changes clicked in the console live only in the running database. Export them
with `hasura metadata export --project hasura` and commit the files. Use the
CLI in the same version as the image (see `hasura/Dockerfile`).

## CI

The `hasura` job creates the schema (with `alembic upgrade head` from
pouw-indexer once it has migrations), runs `hasura/seeds/default/*.sql` in name
order, starts the image and checks the metadata consistency. The image refuses
to start when the metadata references a view or column that does not exist, so
a view that breaks the metadata fails the job.