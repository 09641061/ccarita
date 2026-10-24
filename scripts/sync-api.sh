#!/usr/bin/env bash
# Copies pibble's OpenAPI document into api/ and regenerates the TypeScript types the app compiles against.
# Usage: scripts/sync-api.sh [path/to/openapi.json]   (default: ../pibble/openapi.json)
# Without an argument and without ../pibble, it only regenerates the types from api/openapi.json (as CI does).
set -euo pipefail
cd "$(dirname "$0")/.."
source=${1:-../pibble/openapi.json}
if [[ -f "$source" ]]; then
  cp "$source" api/openapi.json
elif [[ $# -gt 0 ]]; then
  echo "sync-api: $source not found" >&2; exit 1
fi
pnpm exec openapi-typescript api/openapi.json --output src/app/shared/infrastructure/api/pibble.schema.ts \
  --root-types --root-types-no-schema-prefix --immutable --alphabetize
pnpm exec prettier --log-level warn --write src/app/shared/infrastructure/api/pibble.schema.ts
