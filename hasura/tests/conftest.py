"""Query tests of the web API: Hasura with the seed data, run by the hasura job in CI.

Environment:
  HASURA_URL       Hasura to test, default http://localhost:8081 (the local compose.yml)
  WEB_API_GRAPHQL  the contract, default ../pouw-docs/contracts/web-api.graphql
                   (pouw-docs cloned next to this repository)

The requests carry no token, so they run as the role anonymous, like the explorer.
"""

import hashlib
import os
import sys
from pathlib import Path

import pytest
import requests
from graphql import OperationType, parse
from graphql.language import DocumentNode, FragmentDefinitionNode, OperationDefinitionNode

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "hasura"))
from allowlist import entries, is_stream  # noqa: E402  the documents of the allow-list

HASURA_URL = os.environ.get("HASURA_URL", "http://localhost:8081").rstrip("/")
CONTRACT = Path(
    os.environ.get("WEB_API_GRAPHQL", REPO.parent / "pouw-docs" / "contracts" / "web-api.graphql")
)


def seed_id(prefix: str, label: str) -> str:
    """An id of hasura/seeds/default/10_seed.sql: the prefix and sha256 of a readable label."""
    return prefix + hashlib.sha256(label.encode()).hexdigest()


def load_contract() -> DocumentNode:
    if not CONTRACT.is_file():
        pytest.exit(
            f"contract not found: {CONTRACT}. Set WEB_API_GRAPHQL or clone pouw-docs "
            "next to this repository.",
            returncode=2,
        )
    doc = parse(CONTRACT.read_text(encoding="utf-8"))
    # Hasura answers subscriptions only over WebSocket. Over HTTP a live query (HomeStats,
    # LatestBlocks) is sent as a query with the same selection, which reads the same views.
    # A stream (root field *_stream) exists only in subscriptions: test_live.py tests it
    # over WebSocket.
    for d in doc.definitions:
        if (
            isinstance(d, OperationDefinitionNode)
            and d.operation == OperationType.SUBSCRIPTION
            and not is_stream(d)
        ):
            d.operation = OperationType.QUERY
    return doc


DOCUMENT = load_contract()
ALL_OPERATIONS = {
    d.name.value: d for d in DOCUMENT.definitions if isinstance(d, OperationDefinitionNode)
}
# operations over HTTP (test_contract.py) and streams over WebSocket (test_live.py)
OPERATIONS = {n: op for n, op in ALL_OPERATIONS.items() if not is_stream(op)}
STREAMS = {n: op for n, op in ALL_OPERATIONS.items() if is_stream(op)}
FRAGMENTS = {
    d.name.value: d for d in DOCUMENT.definitions if isinstance(d, FragmentDefinitionNode)
}


# The documents exactly as hasura/metadata/query_collections.yaml allows them
TEXTS = entries(CONTRACT.read_text(encoding="utf-8"))


def operation_text(name: str) -> str:
    """One operation with only the fragments it uses, as the allow-list has it. Over HTTP a
    live-query subscription is sent as its query twin (<name>AsQuery)."""
    return TEXTS.get(name + "AsQuery", TEXTS[name])


def post(body: dict) -> dict:
    try:
        r = requests.post(f"{HASURA_URL}/v1/graphql", json=body, timeout=10)
    except requests.ConnectionError:
        pytest.exit(f"Hasura is not running at {HASURA_URL} (docker compose up -d?)", returncode=2)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session", autouse=True)
def database_is_the_seed():
    """The value tests expect exactly the seed chain (blocks 0 to 3). Stop at once with a
    clear message when the database holds more, e.g. while the mock-blocks service runs."""
    body = post({"query": operation_text("HomeStats")})
    if body.get("errors"):
        pytest.exit(
            f"HomeStats failed: {body['errors']}. If the contract changed, update the "
            "allow-list (python hasura/allowlist.py) and rebuild Hasura "
            "(docker compose up -d --build hasura)",
            returncode=2,
        )
    height = (body.get("data") or {}).get("stats", [{}])[0].get("indexed_height")
    if height != 3:
        pytest.exit(
            f"the database is not the seed (newest block {height}, expected 3). Stop the mock "
            "and reset: docker compose stop mock-blocks && docker compose down -v && "
            "docker compose up -d --build",
            returncode=2,
        )


@pytest.fixture
def run():
    """run(operation, variables) -> data of one operation of the contract; fails on errors."""

    def _run(operation: str, variables: dict | None = None) -> dict:
        body = post({"query": operation_text(operation), "variables": variables or {}})
        assert "errors" not in body, f"{operation}: {body['errors']}"
        return body["data"]

    return _run


@pytest.fixture
def raw():
    """raw(query) -> the whole answer of any GraphQL text, errors included."""
    return lambda query: post({"query": query})
