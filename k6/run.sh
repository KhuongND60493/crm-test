#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K6_SCRIPT="${K6_SCRIPT:-${SCRIPT_DIR}/k6-api-post-xml.js}"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env.k6}"
COUPON_CODES_FILE="${COUPON_CODES_FILE:-${SCRIPT_DIR}/coupon-stg.txt}"
FETCH_SCRIPT="${SCRIPT_DIR}/fetch-coupons.js"
PACKAGE_JSON="${SCRIPT_DIR}/package.json"

if [[ $# -ge 1 && -n "${1:-}" ]]; then
  K6_SCRIPT="$1"
fi

if ! command -v k6 >/dev/null 2>&1; then
  echo "Error: k6 is not installed. Please install k6 first."
  exit 1
fi

if [[ ! -f "${K6_SCRIPT}" ]]; then
  echo "Error: Cannot find ${K6_SCRIPT}"
  exit 1
fi

DEFAULT_RPS=10
DEFAULT_DURATION="30s"
DEFAULT_PRE_VUS=20
DEFAULT_MAX_VUS=200
DEFAULT_TARGET_URL="http://118.69.108.41:8100"
DEFAULT_PARTNER_CODE="1"
DEFAULT_TERMINAL_TYPE="CRM_DCORP"
DEFAULT_COUPON_SQL_QUERY="SELECT COUPON_CODE FROM CARD_COUPONS WHERE COUPON_CODE IS NOT NULL AND LTRIM(RTRIM(COUPON_CODE)) <> '' AND DELETED = 0"
DEFAULT_RKCRM_ACTION="Get coupon info"

env_get() {
  local key="$1"
  local value=""

  if [[ -f "${ENV_FILE}" ]]; then
    value="$(awk -F'=' -v k="${key}" '
      $0 ~ /^[[:space:]]*#/ { next }
      $0 ~ /^[[:space:]]*$/ { next }
      {
        rawKey = $1
        gsub(/^[ \t]+|[ \t]+$/, "", rawKey)
        if (rawKey == k) {
          rawVal = substr($0, index($0, "=") + 1)
          gsub(/^[ \t]+|[ \t]+$/, "", rawVal)
          if ((rawVal ~ /^".*"$/) || (rawVal ~ /^'\''.*'\''$/)) {
            rawVal = substr(rawVal, 2, length(rawVal) - 2)
          }
          print rawVal
          exit
        }
      }
    ' "${ENV_FILE}")"
  fi

  printf '%s' "${value}"
}

RPS="${RPS:-$(env_get "RPS")}"
DURATION="${DURATION:-$(env_get "DURATION")}"
PRE_VUS="${PRE_VUS:-$(env_get "PRE_VUS")}"
MAX_VUS="${MAX_VUS:-$(env_get "MAX_VUS")}"
TARGET_URL="${TARGET_URL:-$(env_get "TARGET_URL")}"
PARTNER_CODE="${PARTNER_CODE:-$(env_get "PARTNER_CODE")}"
TERMINAL_TYPE="${TERMINAL_TYPE:-$(env_get "TERMINAL_TYPE")}"
MSSQL_CONNECTION_STRING="${MSSQL_CONNECTION_STRING:-$(env_get "MSSQL_CONNECTION_STRING")}"
COUPON_SQL_QUERY="${COUPON_SQL_QUERY:-$(env_get "COUPON_SQL_QUERY")}"
RKCRM_ACTION="${RKCRM_ACTION:-$(env_get "RKCRM_ACTION")}"

RPS="${RPS:-$DEFAULT_RPS}"
DURATION="${DURATION:-$DEFAULT_DURATION}"
PRE_VUS="${PRE_VUS:-$DEFAULT_PRE_VUS}"
MAX_VUS="${MAX_VUS:-$DEFAULT_MAX_VUS}"
TARGET_URL="${TARGET_URL:-$DEFAULT_TARGET_URL}"
PARTNER_CODE="${PARTNER_CODE:-$DEFAULT_PARTNER_CODE}"
TERMINAL_TYPE="${TERMINAL_TYPE:-$DEFAULT_TERMINAL_TYPE}"
COUPON_SQL_QUERY="${COUPON_SQL_QUERY:-$DEFAULT_COUPON_SQL_QUERY}"
RKCRM_ACTION="${RKCRM_ACTION:-$DEFAULT_RKCRM_ACTION}"
SKIP_COUPON_FETCH="${SKIP_COUPON_FETCH:-1}"

if [[ "${SKIP_COUPON_FETCH}" != "1" ]]; then
  if [[ ! -f "${FETCH_SCRIPT}" ]]; then
    echo "Error: Cannot find ${FETCH_SCRIPT}"
    exit 1
  fi

  if [[ ! -f "${PACKAGE_JSON}" ]]; then
    echo "Error: Cannot find ${PACKAGE_JSON}"
    exit 1
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "Error: node is not installed. Please install Node.js first."
    exit 1
  fi

  if [[ -z "${MSSQL_CONNECTION_STRING:-}" ]]; then
    echo "Error: MSSQL_CONNECTION_STRING is empty in .env.k6"
    exit 1
  fi

  if [[ ! -d "${SCRIPT_DIR}/node_modules" ]]; then
    echo "Installing node dependencies..."
    npm install --prefix "${SCRIPT_DIR}"
  fi

  echo "Fetching coupon codes from SQL Server..."
  MSSQL_CONNECTION_STRING="${MSSQL_CONNECTION_STRING}" \
  COUPON_SQL_QUERY="${COUPON_SQL_QUERY}" \
  COUPON_CODES_FILE="${COUPON_CODES_FILE}" \
  node "${FETCH_SCRIPT}"
else
  echo "Skipping DB fetch. Using existing coupon file: ${COUPON_CODES_FILE}"
fi

if [[ ! -f "${COUPON_CODES_FILE}" ]]; then
  echo "Error: Coupon file not found: ${COUPON_CODES_FILE}"
  exit 1
fi

COUPON_COUNT="$(awk 'END { print NR }' "${COUPON_CODES_FILE}")"
if [[ "${COUPON_COUNT}" -eq 0 ]]; then
  echo "Error: Coupon file is empty: ${COUPON_CODES_FILE}"
  exit 1
fi

echo ""
echo "Starting k6 test with:"
echo "  TARGET_URL=${TARGET_URL}"
echo "  RPS=${RPS}"
echo "  DURATION=${DURATION}"
echo "  PRE_VUS=${PRE_VUS}"
echo "  MAX_VUS=${MAX_VUS}"
echo "  PARTNER_CODE=${PARTNER_CODE}"
echo "  COUPON_CODES_FILE=${COUPON_CODES_FILE} (${COUPON_COUNT} records)"
echo ""

RPS="${RPS}" \
DURATION="${DURATION}" \
PRE_VUS="${PRE_VUS}" \
MAX_VUS="${MAX_VUS}" \
TARGET_URL="${TARGET_URL}" \
PARTNER_CODE="${PARTNER_CODE}" \
TERMINAL_TYPE="${TERMINAL_TYPE}" \
COUPON_CODES_FILE="${COUPON_CODES_FILE}" \
RKCRM_ACTION="${RKCRM_ACTION}" \
k6 run "${K6_SCRIPT}"
