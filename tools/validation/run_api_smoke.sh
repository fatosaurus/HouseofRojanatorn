#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_BASE_URL="${API_BASE_URL:-http://localhost:7071/api}"

echo "[smoke] root: ${ROOT_DIR}"
echo "[smoke] API base URL: ${API_BASE_URL}"
python3 "${ROOT_DIR}/tools/validation/api_smoke.py" --base-url "${API_BASE_URL}"
echo "[smoke] PASS"
