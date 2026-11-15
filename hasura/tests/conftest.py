"""Query tests of the web API: Hasura with the seed data, run by the hasura job in CI.

Environment:
  HASURA_URL       Hasura to test, default http://localhost:8081 (the local compose.yml)
  WEB_API_GRAPHQL  the contract, default ../pouw-docs/contracts/web-api.graphql
                   (pouw-docs cloned next to this repository)

The requests carry no token, so they run as the role anonymous, like the explorer.
"""

import hashlib
import os
from pathlib import Path

import pytest
import requests
from graphql import OperationType, parse, print_ast
from graphql.language import (
    DocumentNode,
    FragmentDefinitionNode,
    FragmentSpreadNode,
    OperationDefinitionNode,
    Visitor,
    visit,
)

REPO = Path(__file__).resolve().parents[2]
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
    # Hasura answers subscriptions only over WebSocket. Over HTTP the same selection is
    # sent as a query, which reads the same views.
    for d in doc.definitions:
        if isinstance(d, OperationDefinitionNode) and d.operation == OperationType.SUBSCRIPTION:
            d.operation = OperationType.QUERY
    return doc


DOCUMENT = load_contract()
OPERATIONS = {
    d.name.value: d for d in DOCUMENT.definitions if isinstance(d, OperationDefinitionNode)
}
FRAGMENTS = {
    d.name.value: d for d in DOCUMENT.definitions if isinstance(d, FragmentDefinitionNode)
}


def operation_text(name: str) -> str:
    """One operation with only the fragments it uses, so a broken operation fails alone."""
    needed, todo = {}, [OPERATIONS[name]]
    while todo:
        spreads = []

        class Spreads(Visitor):
            def enter_fragment_spread(self, node: FragmentSpreadNode, *_):
                spreads.append(node.name.value)

        visit(todo.pop(), Spreads())
        for s in spreads:
            if s not in needed:
                needed[s] = FRAGMENTS[s]
                todo.append(FRAGMENTS[s])
    return print_ast(DocumentNode(definitions=[OPERATIONS[name], *needed.values()]))


def post(body: dict) -> dict:
    try:
        r = requests.post(f"{HASURA_URL}/v1/graphql", json=body, timeout=10)
    except requests.ConnectionError:
        pytest.exit(f"Hasura is not running at {HASURA_URL} (docker compose up -d?)", returncode=2)
    assert r.status_code == 200, r.text
    return r.json()


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
