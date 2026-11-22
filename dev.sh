#!/usr/bin/env bash
set -euo pipefail

# Resolve paths from this file, not from the terminal's current directory.
dashboard_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node "$dashboard_root/scripts/dev.mjs" "$@"
