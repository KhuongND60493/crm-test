#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

env_get() {
  local key="$1"
  awk -F'=' -v k="${key}" '
    $0 ~ /^[[:space:]]*#/ { next }
    $0 ~ /^[[:space:]]*$/ { next }
    {
      rawKey = $1
      gsub(/^[ \t]+|[ \t]+$/, "", rawKey)
      if (rawKey == k) {
        rawVal = substr($0, index($0, "=") + 1)
        gsub(/^[ \t]+|[ \t]+$/, "", rawVal)
        print rawVal
        exit
      }
    }
  ' "${SCRIPT_DIR}/.env.k6" 2>/dev/null || true
}

NEWAPP_URL="${NEWAPP_URL:-$(env_get "TARGET_URL_NEWAPP")}"

if [[ -z "${NEWAPP_URL}" ]]; then
  NEWAPP_URL="$(env_get "TARGET_URL")"
fi

if [[ -z "${NEWAPP_URL}" ]]; then
  NEWAPP_URL="http://127.0.0.1:8100"
fi

# Always use load settings from .env.k6 for this NEWAPP flow.
unset RPS DURATION PRE_VUS MAX_VUS

ENV_FILE="${SCRIPT_DIR}/.env.k6" \
COUPON_CODES_FILE="${SCRIPT_DIR}/coupon-stg.txt" \
NEWAPP_CARDS_FILE="${SCRIPT_DIR}/coupon-stg.txt" \
TARGET_URL="${NEWAPP_URL}" \
SKIP_COUPON_FETCH=1 \
bash "${SCRIPT_DIR}/run.sh" "${SCRIPT_DIR}/k6-newapp-cardinfo.js"
