#!/usr/bin/env python3
"""Export the upstream Hasura allow-list as frontend documents, without adding operations.

Run after the existing `python hasura/allowlist.py` generator. PyYAML is already
part of hasura/tests/requirements.txt. Normal frontend builds use the checked-in JSON.
"""
import argparse
import json
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "web/src/graphql/operations.json"
NEEDED = {
    "queries": {"HomeStats", "LatestBlocks", "Search", "Blocks", "BlockByHeight", "BlockByHash", "Transaction", "Proof", "Circuits", "Circuit", "CircuitProofs", "Address", "AddressTxs", "MinedBlocks", "Mining"},
    "subscriptions": {"HomeStats", "LatestBlocks"},
}


def documents():
    collections = yaml.safe_load((ROOT / "hasura/metadata/query_collections.yaml").read_text())
    collection = next(item for item in collections if item["name"] == "web-api")
    result = {"queries": {}, "subscriptions": {}}
    for item in collection["definition"]["queries"]:
        text = item["query"]
        match = re.match(r"(query|subscription)\s+(\w+)", text)
        if not match:
            raise ValueError(f"Expected one named operation: {item['name']}")
        kind = "queries" if match[1] == "query" else "subscriptions"
        if match[2] in NEEDED[kind]:
            result[kind][match[2]] = text
    for kind, names in NEEDED.items():
        if names != result[kind].keys():
            raise ValueError(f"Missing frontend operations: {sorted(names - result[kind].keys())}")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    content = json.dumps(documents(), indent=2) + "\n"
    if args.check:
        if OUTPUT.read_text() != content:
            raise SystemExit("Frontend documents are stale; run python3 web/scripts/sync-operations.py")
    else:
        OUTPUT.write_text(content)


if __name__ == "__main__":
    main()
