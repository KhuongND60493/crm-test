#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RKCRM_URL="${RKCRM_URL:-$(awk -F'=' '/^[[:space:]]*TARGET_URL_RKCRM[[:space:]]*=/{print substr($0, index($0, "=")+1); exit}' "${SCRIPT_DIR}/.env.k6" 2>/dev/null | sed 's/^[ \t]*//;s/[ \t]*$//')}"
if [[ -z "${RKCRM_URL}" ]]; then
  RKCRM_URL="http://127.0.0.1:8100"
fi

# --- Dual-server load split: đọc và validate tham số tỉ lệ ---
RATIO_1="${1:-}"
RATIO_2="${2:-}"
RKCRM_URL_2=""

if [[ -n "${RATIO_1}" || -n "${RATIO_2}" ]]; then
  # Cả hai phải được truyền
  if [[ -z "${RATIO_1}" || -z "${RATIO_2}" ]]; then
    echo "Error: Phải truyền đủ 2 tham số. Ví dụ: yarn test-rkcrm-cardinfo 50 50"
    exit 1
  fi

  # Phải là số nguyên không âm
  if ! [[ "${RATIO_1}" =~ ^[0-9]+$ ]] || ! [[ "${RATIO_2}" =~ ^[0-9]+$ ]]; then
    echo "Error: Tỉ lệ phải là số nguyên (>= 0). Ví dụ: 50 50, 70 30, 0 100"
    exit 1
  fi

  # Tổng phải = 100
  if [[ $(( RATIO_1 + RATIO_2 )) -ne 100 ]]; then
    echo "Error: RATIO_1 + RATIO_2 phải = 100 (hiện tại: ${RATIO_1} + ${RATIO_2} = $(( RATIO_1 + RATIO_2 )))"
    exit 1
  fi

  # TARGET_URL_RKCRM_2 phải được set trong .env.k6
  RKCRM_URL_2="$(awk -F'=' '/^[[:space:]]*TARGET_URL_RKCRM_2[[:space:]]*=/{print substr($0, index($0, "=")+1); exit}' "${SCRIPT_DIR}/.env.k6" 2>/dev/null | sed 's/^[ \t]*//;s/[ \t]*$//')"
  if [[ -z "${RKCRM_URL_2}" ]]; then
    echo "Error: TARGET_URL_RKCRM_2 chưa được cấu hình trong .env.k6"
    exit 1
  fi

  echo "Dual-server mode: sv1=${RKCRM_URL} (${RATIO_1}%) | sv2=${RKCRM_URL_2} (${RATIO_2}%)"
fi

# Always use load settings from .env.k6 for this RKCRM flow.
unset RPS DURATION PRE_VUS MAX_VUS

ENV_FILE="${SCRIPT_DIR}/.env.k6" \
COUPON_CODES_FILE="${SCRIPT_DIR}/cp1.txt" \
TARGET_URL="${RKCRM_URL}" \
TARGET_URL_SV2="${RKCRM_URL_2}" \
K6_RATIO_1="${RATIO_1}" \
K6_RATIO_2="${RATIO_2}" \
SKIP_COUPON_FETCH=1 \
bash "${SCRIPT_DIR}/run.sh" "${SCRIPT_DIR}/k6-rkcrm-cardinfo.js"
