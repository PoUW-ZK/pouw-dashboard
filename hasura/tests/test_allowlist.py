"""Allow-list, permissions and limits of the role anonymous (pouw-dashboard#47).

Two layers keep an anonymous client to the explorer's reads:
  1. the allow-list: Hasura runs only the documents of hasura/metadata/query_collections.yaml,
     written from the contract by hasura/allowlist.py; anything else is rejected,
  2. the permissions: select only, at most 100 rows a request, no aggregates.
With the allow-list on, an unknown query never reaches layer 2, so layer 2 is checked
here in the metadata files, and layer 1 against the running Hasura.
"""

import asyncio
import json
from pathlib import Path

import pytest
import websockets
import yaml

from conftest import CONTRACT, REPO, operation_text

from allowlist import COLLECTION, COLLECTIONS, render  # noqa: E402  (conftest set sys.path)

METADATA = REPO / "hasura" / "metadata"
TABLES = METADATA / "databases" / "default" / "tables"
MAX_ROWS = 100


def rejected(body: dict) -> bool:
    return bool(body.get("errors")) and not body.get("data")


# ------------------------------------------------------------------ 1. allow-list in the repo

def test_allow_list_matches_the_contract():
    assert COLLECTIONS.read_text(encoding="utf-8") == render(
        CONTRACT.read_text(encoding="utf-8")
    ), (
        f"{COLLECTIONS.name} differs from {CONTRACT}: run python hasura/allowlist.py "
        "and commit hasura/metadata/query_collections.yaml"
    )


def test_allow_list_uses_the_collection_for_every_role():
    entries = yaml.safe_load((METADATA / "allow_list.yaml").read_text(encoding="utf-8"))
    # Hasura CE ignores role-based scopes, so the collection must be global
    assert entries == [{"collection": COLLECTION, "scope": {"global": True}}]


def test_image_enables_the_allow_list():
    dockerfile = (REPO / "hasura" / "Dockerfile").read_text(encoding="utf-8")
    assert "HASURA_GRAPHQL_ENABLE_ALLOWLIST=true" in dockerfile


# ------------------------------------------------------------------ 2. permissions in the repo

def table_files() -> list[Path]:
    return sorted(TABLES.glob("api_*.yaml"))


@pytest.mark.parametrize("path", table_files(), ids=lambda p: p.stem)
def test_anonymous_reads_at_most_100_rows_and_nothing_else(path):
    table = yaml.safe_load(path.read_text(encoding="utf-8"))
    for kind in ("insert_permissions", "update_permissions", "delete_permissions"):
        assert not table.get(kind), f"{path.name}: {kind} must stay empty"
    selects = table.get("select_permissions") or []
    assert [p["role"] for p in selects] == ["anonymous"], f"{path.name}: {selects}"
    permission = selects[0]["permission"]
    assert 0 < permission.get("limit", 0) <= MAX_ROWS, f"{path.name}: limit {permission}"
    assert not permission.get("allow_aggregations"), f"{path.name}: aggregates are allowed"
    assert not permission.get("subscription_root_fields") or set(
        permission["subscription_root_fields"]
    ) <= {"select", "select_stream"}, f"{path.name}: {permission}"


# ------------------------------------------------------------------ 3. allow-list in Hasura
# That every operation of the contract is allowed is tested by test_contract.py and
# test_live.py: they send exactly these documents and fail on any error.

def test_unknown_query_is_rejected(raw):
    """Done criterion of #47: an unknown query of an anonymous client is rejected."""
    body = raw("{ blocks(limit: 1) { hash height } }")
    assert rejected(body), f"an unknown query was answered: {body}"


def test_changed_operation_is_rejected(raw):
    """Only the exact documents: the same operation with one field less is unknown."""
    text = operation_text("HomeStats")
    assert "circuit_count" in text
    body = raw(text.replace("circuit_count", ""))
    assert rejected(body), f"a changed operation was answered: {body}"


def test_introspection_is_rejected(raw):
    body = raw("{ __schema { queryType { name } } }")
    assert rejected(body), f"anonymous can read the schema: {body}"


def test_unknown_subscription_is_rejected():
    from test_live import WS_URL

    async def next_message(ws) -> dict:
        while True:
            msg = json.loads(await asyncio.wait_for(ws.recv(), 5))
            if msg["type"] == "ping":
                await ws.send(json.dumps({"type": "pong"}))
            elif msg["type"] != "pong":
                return msg

    async def scenario():
        async with websockets.connect(WS_URL, subprotocols=["graphql-transport-ws"]) as ws:
            await ws.send(json.dumps({"type": "connection_init", "payload": {}}))
            assert (await next_message(ws))["type"] == "connection_ack"
            await ws.send(json.dumps({
                "id": "1",
                "type": "subscribe",
                "payload": {"query": "subscription { blocks(limit: 1) { height } }"},
            }))
            return await next_message(ws)

    msg = asyncio.run(scenario())
    if msg["type"] == "next":
        assert rejected(msg["payload"]), f"an unknown subscription was answered: {msg}"
    else:
        assert msg["type"] == "error", msg
