#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RKCRM_URL="${RKCRM_URL:-$(awk -F'=' '/^[[:space:]]*TARGET_URL_RKCRM[[:space:]]*=/{print substr($0, index($0, "=")+1); exit}' "${SCRIPT_DIR}/.env.k6" 2>/dev/null | sed 's/^[ \t]*//;s/[ \t]*$//')}"
if [[ -z "${RKCRM_URL}" ]]; then
  RKCRM_URL="http://127.0.0.1:8100"
fi

# Always use load settings from .env.k6 for this RKCRM flow.
unset RPS DURATION PRE_VUS MAX_VUS

ENV_FILE="${SCRIPT_DIR}/.env.k6" \
COUPON_CODES_FILE="${SCRIPT_DIR}/customer-stg.txt" \
TARGET_URL="${RKCRM_URL}" \
SKIP_COUPON_FETCH=1 \
bash "${SCRIPT_DIR}/run.sh" "${SCRIPT_DIR}/k6-rkcrm-cardholder.js"
