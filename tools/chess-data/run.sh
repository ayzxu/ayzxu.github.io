#!/usr/bin/env bash
# Bundle a TypeScript tool with rolldown (the same toolchain Vite uses) and run
# it, so benchmarks measure the code as shipped rather than through a loader.
# Usage: tools/chess-data/run.sh tools/chess-data/bench.ts [args...]
set -euo pipefail
src="$1"; shift
out="$(mktemp -d)/$(basename "${src%.ts}").mjs"
npx rolldown "$src" --format esm --platform node --file "$out" --log-level warn >/dev/null
node "$out" "$@"
