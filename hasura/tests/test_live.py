"""Live streams of the contract (NewBlocks, NewTransfers, NewProofs) over WebSocket.

A block is added to the database with mock.add_block() (hasura/mock/mock_blocks.sql),
and the stream must deliver it within 2 seconds (pouw-dashboard#45). The added blocks are
deleted afterwards, so the other tests see only the seed.

Environment, besides HASURA_URL and WEB_API_GRAPHQL (conftest.py):
  DATABASE_URL    Postgres of that Hasura, default the local compose.yml (port 5433)
  HASURA_WS_URL   WebSocket endpoint, default HASURA_URL with ws:// and /v1/graphql
"""

import asyncio
import json
import os
import time

import psycopg
import pytest
import websockets

from conftest import HASURA_URL, REPO, STREAMS, operation_text
from test_contract import check_shape, selected

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://pouw:pouw@localhost:5433/pouw")
WS_URL = os.environ.get(
    "HASURA_WS_URL", HASURA_URL.replace("http", "ws", 1) + "/v1/graphql"
)
MOCK_SQL = REPO / "hasura" / "mock" / "mock_blocks.sql"
LIMIT_S = 2.0  # done criterion of #45: a new block reaches the frontend within 2 s


@pytest.fixture(scope="module")
def add_block():
    """add_block() -> height of a new mock block. The new blocks are removed at the end."""
    try:
        db = psycopg.connect(DATABASE_URL, autocommit=True)
    except psycopg.OperationalError as e:
        pytest.exit(f"Postgres not reachable at {DATABASE_URL}: {e}", returncode=2)
    tip = db.execute("SELECT max(height) FROM blocks WHERE canonical").fetchone()[0]
    db.execute(MOCK_SQL.read_text(encoding="utf-8"))
    yield lambda: db.execute("SELECT mock.add_block()").fetchone()[0]
    # transfers and proof_txs go with their blocks (ON DELETE CASCADE)
    db.execute("DELETE FROM blocks WHERE height > %s", (tip,))
    db.execute(
        "DO $$ BEGIN IF to_regprocedure('api.refresh_stats()') IS NOT NULL "
        "THEN PERFORM api.refresh_stats(); END IF; END $$"
    )
    db.close()


class Stream:
    """One subscription of the contract over graphql-transport-ws, as a browser opens it."""

    def __init__(self, operation: str, variables: dict):
        self.operation, self.variables = operation, variables
        field = STREAMS[operation].selection_set.selections[0]
        self.root, self.shape = field.name.value, selected(field.selection_set)

    async def recv(self, timeout: float) -> dict:
        """The next message for this subscription. The protocol lets either side send ping
        at any time (Hasura sends one as keepalive); a ping is answered with pong here."""
        end = time.monotonic() + timeout
        while True:
            msg = json.loads(await asyncio.wait_for(self.ws.recv(), max(end - time.monotonic(), 0.001)))
            if msg["type"] == "ping":
                await self.ws.send(json.dumps({"type": "pong"}))
            elif msg["type"] != "pong":
                return msg

    async def __aenter__(self):
        self.ws = await websockets.connect(WS_URL, subprotocols=["graphql-transport-ws"])
        await self.ws.send(json.dumps({"type": "connection_init", "payload": {}}))
        ack = await self.recv(5)
        assert ack["type"] == "connection_ack", ack
        await self.ws.send(json.dumps({
            "id": "1",
            "type": "subscribe",
            "payload": {"query": operation_text(self.operation), "variables": self.variables},
        }))
        return self

    async def __aexit__(self, *_):
        await self.ws.close()

    async def rows(self, timeout: float) -> list:
        """The next non-empty batch of rows, or [] when none comes within timeout."""
        end = time.monotonic() + timeout
        while (left := end - time.monotonic()) > 0:
            try:
                msg = await self.recv(left)
            except asyncio.TimeoutError:
                break
            assert msg["type"] not in ("error", "complete"), f"{self.operation}: {msg}"
            if msg["type"] == "next":
                assert "errors" not in msg["payload"], f"{self.operation}: {msg['payload']}"
                batch = msg["payload"]["data"][self.root]
                check_shape(batch, self.shape, self.operation)
                if batch:
                    return batch
        return []


def newest(run, operation: str, key: str):
    rows = next(iter(run(operation, {"limit": 1}).values()))
    return rows[0][key] if rows else None


def test_every_stream_is_tested():
    assert set(STREAMS) == {"NewBlocks", "NewTransfers", "NewProofs"}, (
        "a new stream in the contract needs a test here"
    )


def test_new_block_arrives_within_two_seconds(run, add_block):
    """Hasura polls a stream about once a second, so the delay depends on when in that
    cycle a block lands. Three blocks at different points of the cycle; the slowest counts."""
    tip = newest(run, "Blocks", "height")

    async def scenario():
        delays = []
        async with Stream("NewBlocks", {"fromHeight": tip}) as stream:
            assert await stream.rows(1.5) == [], "the stream sent blocks at or below the cursor"
            for pause in (0.2, 0.5, 0.8):
                await asyncio.sleep(pause)
                start = time.monotonic()
                height = add_block()
                rows = await stream.rows(5)
                assert [b["height"] for b in rows] == [height], f"expected block {height}, got {rows}"
                delays.append(time.monotonic() - start)
        return delays

    delays = asyncio.run(scenario())
    assert max(delays) < LIMIT_S, f"slowest new block arrived after {max(delays):.2f} s ({delays})"


def test_stream_starts_after_the_cursor_oldest_first(add_block):
    async def scenario():
        async with Stream("NewBlocks", {"fromHeight": 1, "batchSize": 100}) as stream:
            return await stream.rows(5)

    heights = [b["height"] for b in asyncio.run(scenario())]
    assert heights[:2] == [2, 3] and heights == sorted(heights)


def test_new_transfer_and_proof_arrive(run, add_block):
    after_transfer = newest(run, "LatestTransfers", "sort_key") or ""
    after_proof = newest(run, "LatestProofs", "sort_key") or ""

    async def scenario():
        async with Stream("NewTransfers", {"fromSortKey": after_transfer}) as transfers, \
                Stream("NewProofs", {"fromSortKey": after_proof}) as proofs:
            await transfers.rows(1.5)  # nothing yet
            await proofs.rows(0.1)
            start = time.monotonic()
            height = add_block()
            got = await asyncio.gather(transfers.rows(5), proofs.rows(5))
            return height, got, time.monotonic() - start

    height, (new_transfers, new_proofs), took = asyncio.run(scenario())
    assert [t["height"] for t in new_transfers] == [height]
    assert [p["height"] for p in new_proofs] == [height]
    assert took < LIMIT_S, f"transfer and proof of block {height} arrived after {took:.2f} s"
