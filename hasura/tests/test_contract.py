"""Every operation of the contract (pouw-docs/contracts/web-api.graphql) against Hasura
with the seed data of hasura/seeds/default/10_seed.sql.

1. Shape: each operation runs without errors, returns data, every returned object has
   exactly the fields the operation selects (fragments included), and the values follow
   the conventions of web-api.md (prefixed ids, hex field elements, ISO times, numbers).
   A new operation in the contract is tested here once it has its variables in VARIABLES.
2. Values: the numbers of the seed chain, so a wrong view is noticed.
3. Access: the role anonymous can only read the api views.
"""

import re
from datetime import datetime

import pytest
from graphql import FieldNode, FragmentSpreadNode, InlineFragmentNode, NonNullTypeNode

from conftest import FRAGMENTS, OPERATIONS, seed_id

BLOCK_2 = seed_id("blk:", "blk-2")
BLOCK_3_ORPHANED = seed_id("blk:", "blk-3b")
TRANSFER_IN_TWO_BLOCKS = seed_id("tx:", "tx-pay-2")
TRANSFER = seed_id("tx:", "tx-pay-1")
PROOF_REQUEST = seed_id("tx:", "req-1")
PROOF = seed_id("proof:", "proof-1")
REGISTRATION = seed_id("tx:", "reg-sha")
CIRCUIT_GROTH16 = seed_id("circ:", "reg-sha")
CLIENT = seed_id("addr:", "client-c")
MINER = seed_id("addr:", "miner-a")

# Variables that make each operation return seed data
VARIABLES = {
    "Search": {"q": "3"},
    "BlockByHeight": {"height": 2},
    "BlockByHash": {"hash": BLOCK_2},
    "Transaction": {"txid": TRANSFER_IN_TWO_BLOCKS},
    "Proof": {"proofHash": PROOF},
    "Circuit": {"circuitId": CIRCUIT_GROTH16},
    "CircuitProofs": {"circuitId": CIRCUIT_GROTH16},
    "Address": {"address": CLIENT},
    "AddressTxs": {"address": CLIENT},
    "MinedBlocks": {"miner": MINER},
}


# ------------------------------------------------------------------ 1. shape

# Conventions of web-api.md, by field name
ID_PREFIX = {
    "hash": "blk", "prev_hash": "blk", "block_hash": "blk", "registered_block": "blk",
    "txid": "tx", "request_txid": "tx",
    "proof_hash": "proof",
    "circuit_id": "circ",
    "miner": "addr", "sender": "addr", "recipient": "addr", "client": "addr",
    "registrant": "addr", "address": "addr",
}
HEX = {"tx_root": 64, "witness_sha256": 64, "eta": 62, "mask": 62}
TIMES = {"time", "registered_time", "latest_block_time"}
NUMBERS = {
    "height", "difficulty", "bucket_count", "bucket_id", "size_bytes", "position", "fee",
    "fee_total", "amount", "nonce", "usage_counter", "constraint_count", "proof_count",
    "transfer_count", "registration_count", "block_count", "circuit_count", "blocks",
    "useful_work", "public_input_count", "proof_bytes", "witness_bytes", "indexed_height",
    "registered_height", "last_proof_height", "first_seen_height", "txs_sent",
    "txs_received", "proof_requests", "circuits_registered", "blocks_mined",
    "verifying_key_bytes", "circuit_bytes", "last_block_height",
}


def check_value(key: str, value, path: str):
    if value is None:
        return
    if key in ID_PREFIX:
        assert re.fullmatch(ID_PREFIX[key] + r":[0-9a-f]{64}", value), f"{path}: bad id {value!r}"
    elif key in HEX:
        assert re.fullmatch(f"[0-9a-f]{{{HEX[key]}}}", value), f"{path}: bad hex {value!r}"
    elif key in TIMES:
        assert datetime.fromisoformat(value).tzinfo, f"{path}: time without offset {value!r}"
    elif key in NUMBERS:
        assert isinstance(value, int) and not isinstance(value, bool), f"{path}: not an integer {value!r}"

def selected(selection_set) -> dict:
    """{response key: selected sub-fields, or None for a scalar} of a selection set."""
    shape = {}
    for sel in selection_set.selections:
        if isinstance(sel, FieldNode):
            key = sel.alias.value if sel.alias else sel.name.value
            shape[key] = selected(sel.selection_set) if sel.selection_set else None
        elif isinstance(sel, FragmentSpreadNode):
            shape.update(selected(FRAGMENTS[sel.name.value].selection_set))
        elif isinstance(sel, InlineFragmentNode):
            shape.update(selected(sel.selection_set))
    return shape


def check_shape(value, shape: dict, path: str):
    if value is None:  # an object relationship or a nullable field
        return
    if isinstance(value, list):
        for i, item in enumerate(value):
            check_shape(item, shape, f"{path}[{i}]")
        return
    assert isinstance(value, dict), f"{path}: expected an object, got {value!r}"
    assert set(value) == set(shape), (
        f"{path}: fields {sorted(value)} differ from the selection {sorted(shape)}"
    )
    for key, sub in shape.items():
        if sub is None:
            check_value(key, value[key], f"{path}.{key}")
        else:
            check_shape(value[key], sub, f"{path}.{key}")


def test_every_operation_has_its_variables():
    for name, op in OPERATIONS.items():
        required = {
            v.variable.name.value
            for v in op.variable_definitions
            if isinstance(v.type, NonNullTypeNode) and v.default_value is None
        }
        missing = required - set(VARIABLES.get(name, {}))
        assert not missing, f"add {sorted(missing)} for operation {name} to VARIABLES"


@pytest.mark.parametrize("operation", sorted(OPERATIONS))
def test_operation_returns_the_selected_shape(run, operation):
    data = run(operation, VARIABLES.get(operation))
    shape = selected(OPERATIONS[operation].selection_set)
    check_shape(data, shape, operation)
    assert any(v not in (None, []) for v in data.values()), f"{operation} returned no data"


# ------------------------------------------------------------------ 2. values of the seed

def test_home_stats(run):
    stats = run("HomeStats")["stats"]
    assert len(stats) == 1
    assert stats[0]["indexed_height"] == 3
    assert stats[0]["block_count"] == 4
    assert stats[0]["circuit_count"] == 2


def test_latest_blocks_are_canonical_newest_first(run):
    heights = [b["height"] for b in run("LatestBlocks")["blocks"]]
    assert heights == [3, 2, 1, 0]


def test_blocks_paging(run):
    first = run("Blocks", {"limit": 2})["blocks"]
    assert [b["height"] for b in first] == [3, 2]
    second = run("Blocks", {"limit": 2, "before": first[-1]["height"]})["blocks"]
    assert [b["height"] for b in second] == [1, 0]


def test_block_detail(run):
    block = run("BlockByHeight", {"height": 2})["blocks"][0]
    assert block["hash"] == BLOCK_2
    assert block["fee_total"] == 225
    assert [p["position"] for p in block["proofs"]] == [0, 1]
    assert len(block["transfers"]) == 1
    assert block["registrations"] == []


def test_orphaned_block_only_by_hash(run):
    by_height = run("BlockByHeight", {"height": 3})["blocks"]
    assert len(by_height) == 1 and by_height[0]["canonical"]
    orphaned = run("BlockByHash", {"hash": BLOCK_3_ORPHANED})["blocks"]
    assert len(orphaned) == 1 and orphaned[0]["canonical"] is False


def test_transaction_kinds(run):
    transfer = run("Transaction", {"txid": TRANSFER_IN_TWO_BLOCKS})
    assert len(transfer["transfers"]) == 2 and transfer["transfers"][0]["canonical"]
    assert transfer["circuits"] == [] and transfer["proofs"] == []

    registration = run("Transaction", {"txid": REGISTRATION})
    assert [c["circuit_id"] for c in registration["circuits"]] == [CIRCUIT_GROTH16]

    request = run("Transaction", {"txid": PROOF_REQUEST})
    assert [p["proof_hash"] for p in request["proofs"]] == [PROOF]

    unknown = run("Transaction", {"txid": "tx:" + "0" * 64})
    assert unknown == {"transfers": [], "circuits": [], "proofs": []}


def test_proof_detail(run):
    proof = run("Proof", {"proofHash": PROOF})["proofs"][0]
    assert proof["request_txid"] == PROOF_REQUEST
    assert proof["proof_system"] == "groth16"
    assert proof["usage_counter"] == 0
    assert proof["public_input_count"] == 2
    assert len(proof["eta"]) == 62 and len(proof["mask"]) == 62


def test_circuits(run):
    assert len(run("Circuits")["circuits"]) == 2
    plonk = run("Circuits", {"filter": {"proof_system": {"_eq": "plonk_kzg"}}})["circuits"]
    assert [c["proof_system"] for c in plonk] == ["plonk_kzg"]

    circuit = run("Circuit", {"circuitId": CIRCUIT_GROTH16})["circuits"][0]
    assert circuit["proof_count"] == 2
    assert circuit["useful_work"] == 2 * 65536


def test_circuit_proofs_paging(run):
    first = run("CircuitProofs", {"circuitId": CIRCUIT_GROTH16, "limit": 1})["proofs"]
    second = run(
        "CircuitProofs",
        {"circuitId": CIRCUIT_GROTH16, "limit": 1, "before": first[-1]["sort_key"]},
    )["proofs"]
    assert [p["height"] for p in first + second] == [3, 2]
    third = run(
        "CircuitProofs",
        {"circuitId": CIRCUIT_GROTH16, "limit": 1, "before": second[-1]["sort_key"]},
    )["proofs"]
    assert third == []


def test_address(run):
    address = run("Address", {"address": CLIENT})["addresses"][0]
    assert address["circuits_registered"] == 2
    assert address["proof_requests"] == 2
    assert address["txs_received"] == 1


def test_address_txs_paging_has_no_gaps_or_repeats(run):
    rows, before = [], None
    while True:
        variables = {"address": CLIENT, "limit": 2}
        if before:
            variables["before"] = before
        page = run("AddressTxs", variables)["address_txs"]
        rows += page
        if len(page) < 2:
            break
        before = page[-1]["sort_key"]
    keys = [r["sort_key"] for r in rows]
    assert keys == sorted(keys, reverse=True) and len(set(keys)) == len(keys)
    assert [(r["kind"], r["height"]) for r in rows] == [
        ("proof_request", 3),
        ("transfer", 3),
        ("proof_request", 2),
        ("register_circuit", 1),
        ("register_circuit", 1),
    ]


def test_mined_blocks(run):
    heights = [b["height"] for b in run("MinedBlocks", {"miner": MINER})["blocks"]]
    assert heights == [3, 2, 0]


def test_mining(run):
    data = run("Mining")
    shares = {m["miner"]: m["share"] for m in data["miner_shares"]}
    assert shares[MINER] == pytest.approx(0.75)
    assert sum(shares.values()) == pytest.approx(1)
    work = {w["proof_system"]: w["useful_work"] for w in data["useful_work"]}
    assert work == {"groth16": 2 * 65536, "plonk_kzg": 262144, "marlin": 0}


@pytest.mark.parametrize(
    ("q", "kind"),
    [
        ("3", "block"),
        (BLOCK_2, "block"),
        (PROOF_REQUEST, "proof"),
        (REGISTRATION, "circuit"),
        (CLIENT, "address"),
        (TRANSFER, "transfer"),
        (PROOF, "proof"),
        (CIRCUIT_GROTH16, "circuit"),
    ],
)
def test_search_finds(run, q, kind):
    hits = run("Search", {"q": q})["search"]
    assert [h["kind"] for h in hits] == [kind]


@pytest.mark.parametrize("q", ["hello", "999", "tx:" + "0" * 64])
def test_search_without_match_is_empty(run, q):
    assert run("Search", {"q": q})["search"] == []


# ------------------------------------------------------------------ 3. access of anonymous

def test_anonymous_cannot_write(raw):
    body = raw("mutation { delete_blocks(where: {}) { affected_rows } }")
    assert "errors" in body


def test_indexer_tables_and_prefixed_names_are_not_exposed(raw):
    for field in ("api_blocks", "transfers_aggregate", "miners"):
        body = raw(f"{{ {field} {{ __typename }} }}")
        assert "errors" in body, f"{field} is readable by anonymous"
