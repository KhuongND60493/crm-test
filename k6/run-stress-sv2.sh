#!/bin/sh
set -a
. ./k6/.env.k6
set +a

# Parse --log flag
ENABLE_LOG=0
for arg in "$@"; do
  if [ "$arg" = "--log" ]; then
    ENABLE_LOG=1
  fi
done

TS=$(date "+%d-%m-%Y-%H%M%S")

K6_RUN="k6 run \
  -e TARGET_URL=\"$TARGET_URL_RKCRM_2\" \
  -e COUPON_CODES_FILE=./cp1.txt \
  -e TERMINAL_TYPE=\"$TERMINAL_TYPE\" \
  -e FLOW_RPS=\"${FLOW_RPS:-7}\" \
  -e PRE_VUS=\"${PRE_VUS:-400}\" \
  -e MAX_VUS=\"${MAX_VUS:-500}\" \
  -e DURATION=\"${DURATION:-60s}\""

if [ "$ENABLE_LOG" = "1" ]; then
  mkdir -p logs
  RAW_LOG="logs/raw-$TS.log"
  OUT_LOG="logs/stress-rkcrm-flow-sv2-$TS.log"
  eval $K6_RUN --log-output="file=$RAW_LOG" ./k6/k6-rkcrm-flow-stress.js
  node k6/process-log.js "$RAW_LOG" "$OUT_LOG"
  rm -f "$RAW_LOG"
  echo "[log] Saved → $OUT_LOG"
else
  eval $K6_RUN ./k6/k6-rkcrm-flow-stress.js
fi
