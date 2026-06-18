# PLAN-per-request-log-file

> SPEC: `.ai/specs/SPEC-per-request-log-file.md`
> Date: 2026-06-18
> Approach: k6 `console.log()` + k6 `--log-output=file=...` + Node.js post-processor

---

## Approach Overview

```
k6 script (k6-rkcrm-flow-stress.js)
  → console.log("REQLOG|" + formattedLine)   ← có access res.body, timing, eCode
  → k6 --log-output=file=logs/raw-{TS}.log   ← k6 tự ghi file, không cần k6/experimental/fs
  → Node.js k6/process-log.js                ← strip k6 prefix, viết file .log sạch
  → logs/stress-rkcrm-flow-sv2-{TS}.log      ← output cuối
```

**Tại sao tốt hơn chỉ dùng k6/experimental/fs:**
- Không cần async/await, không lo concurrent write
- `console.log` là sync, không block VU
- Node.js xử lý file I/O tốt hơn k6
- k6 `--log-output` là built-in stable API

---

## 1. Files thay đổi

| File | Action | Ghi chú |
|------|--------|---------|
| `k6/k6-rkcrm-flow-stress.js` | Modify | Thêm `console.log("REQLOG|...")` sau mỗi `http.post` — luôn emit, k6 chỉ ghi nếu `--log-output` được set |
| `k6/process-log.js` | Create | Node.js script: đọc raw log → ghi `.log` file sạch |
| `k6/run-stress-sv2.sh` | Create | Shell wrapper nhận `--log` flag, quyết định có logging không |
| `package.json` | Modify | Đổi script `stress-rkcrm-flow-sv2` gọi `k6/run-stress-sv2.sh "$@"` |
| `.gitignore` | Modify | Thêm `logs/` |

---

## 2. Steps (theo thứ tự dependency)

---

**[CFG-01]** Thêm `logs/` vào `.gitignore`
- File: `.gitignore`
- Thêm dòng: `logs/`

---

**[K6-01]** Thêm `buildLogLine()` helper vào `k6-rkcrm-flow-stress.js`

- File: `k6/k6-rkcrm-flow-stress.js`
- Thêm hàm sau các hàm `buildCardInfoPayload` / `buildTransactionPayload` hiện có:

```js
function buildLogLine(step, eCode, sent, recv, duration, pass, body) {
  const ts     = new Date().toISOString();
  const result = pass ? "PASS" : "FAIL";
  let snippet;
  if (body === null || body === undefined || body.trim().length === 0) {
    snippet = pass ? "(empty)" : "(timeout)";
  } else {
    snippet = body.trim().substring(0, 100);
  }
  // Dùng pipe | làm separator, KHÔNG dùng ký tự có trong XML để tránh parse issue
  return `REQLOG|${ts}|${step}|eCode=${eCode}|sent=${sent}|recv=${recv}|${duration}ms|${result}|${snippet}`;
}
```

---

**[K6-02]** Thêm `console.log` call sau mỗi `http.post` trong `default()`

- File: `k6/k6-rkcrm-flow-stress.js`
- Pattern áp dụng cho cả 3 step:

```js
// Bước 1: getCardInfo lần 1
const sent1 = Date.now();
const res1  = http.post(TARGET_URL, buildCardInfoPayload(eCode), {
  headers,
  tags: { step: "step1" },
});
const recv1 = Date.now();
// ... metric adds hiện tại giữ nguyên ...
const ok1 = check(res1, { "step1 2xx": (r) => r.status >= 200 && r.status < 300 });
console.log(buildLogLine("step1", eCode, sent1, recv1, res1.timings.duration, ok1, res1.body));
if (!ok1) {
  m.failed.add(1);
  step1Failed.add(1);
  flowFailed.add(1);
  return;
}
```

- Tương tự cho `step2` (res2, sent2, recv2) và `step3` (res3, sent3, recv3)
- Đặt `console.log(...)` **sau** `check()` để `ok` đã có giá trị, **trước** `if (!ok)` return

---

**[NODE-01]** Tạo `k6/process-log.js` — Node.js post-processor

- File: `k6/process-log.js` (mới)
- Script này chạy SAU k6, đọc raw log, filter dòng REQLOG, ghi file `.log` sạch

```js
// k6/process-log.js
// Usage: node k6/process-log.js <raw-log-file> <output-log-file>
const fs   = require("fs");
const path = require("path");

const [,, rawFile, outFile] = process.argv;
if (!rawFile || !outFile) {
  console.error("Usage: node k6/process-log.js <raw-log> <output-log>");
  process.exit(1);
}

const raw   = fs.readFileSync(rawFile, "utf8");
const lines = raw.split(/\r?\n/);

// k6 log line format (with --log-output=file):
// time="2026-06-18T07:30:22+07:00" level=info msg="REQLOG|..."
// Extract msg value and filter only REQLOG lines
const logLines = lines
  .map((line) => {
    const match = line.match(/msg="(REQLOG\|[^"]+)"/);
    if (!match) return null;
    // Convert pipe-separated REQLOG format to space-separated readable format
    // REQLOG|{ts}|{step}|eCode=...|sent=...|recv=...|{dur}ms|{PASS/FAIL}|{snippet}
    const parts = match[1].split("|");
    // parts[0] = "REQLOG", parts[1..] = actual fields
    return parts.slice(1).join(" | ");
  })
  .filter(Boolean);

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, logLines.join("\n") + "\n", "utf8");
console.log(`[process-log] Written ${logLines.length} lines → ${outFile}`);
```

---

**[SH-01]** Tạo `k6/run-stress-sv2.sh` — shell wrapper với `--log` opt-in

- File: `k6/run-stress-sv2.sh` (mới, executable)
- Logic: parse `$@` tìm flag `--log`, nếu có thì bật logging pipeline, nếu không thì chạy k6 thuần

```bash
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
K6_ARGS="-e TARGET_URL=\"$TARGET_URL_RKCRM_2\" \
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
  eval k6 run $K6_ARGS --log-output="file=$RAW_LOG" ./k6/k6-rkcrm-flow-stress.js
  node k6/process-log.js "$RAW_LOG" "$OUT_LOG"
  rm -f "$RAW_LOG"
  echo "[log] Saved → $OUT_LOG"
else
  eval k6 run $K6_ARGS ./k6/k6-rkcrm-flow-stress.js
fi
```

> `;` thay vì `&&` giữa k6 và process-log: process-log phải chạy kể cả khi k6 exit non-zero (threshold fail).

---

**[PKG-01]** Cập nhật `package.json` — script `stress-rkcrm-flow-sv2`

- File: `package.json`
- Thay toàn bộ inline `sh -c '...'` bằng gọi shell script, truyền `"$@"`:

```json
"stress-rkcrm-flow-sv2": "sh k6/run-stress-sv2.sh"
```

- Cách dùng sau khi implement:
  ```bash
  yarn stress-rkcrm-flow-sv2           # chạy bình thường, không log file
  yarn stress-rkcrm-flow-sv2 --log     # chạy + ghi logs/stress-rkcrm-flow-sv2-{ts}.log
  FLOW_RPS=100 yarn stress-rkcrm-flow-sv2 --log   # kết hợp env var + log flag
  ```

> **Lưu ý yarn arg passing:** yarn v1 tự động forward args sau script name sang shell. `"$@"` không cần thiết trong npm script string — yarn gắn args vào cuối command.
> Nếu dùng npm (không phải yarn): `npm run stress-rkcrm-flow-sv2 -- --log`

---

## 3. DI Registration

Không áp dụng.

---

## 4. DB/API/Config changes

Không có.

**File mới:** `logs/` (gitignored), `k6/process-log.js`

---

## 5. Cursor Notes

> Paste section này vào đầu chat Cursor trước khi `/implement`.

- **k6 side** (`k6-rkcrm-flow-stress.js`): chỉ thêm `buildLogLine()` helper và 3 `console.log()` calls — KHÔNG đổi options, metrics, handleSummary, buildPayload functions
- **`sent` / `recv`**: dùng `Date.now()` (epoch ms) — gọi TRƯỚC và SAU `http.post` tương ứng
- **`console.log` placement**: sau `check()`, trước `if (!ok) return` — để `ok` đã resolve
- **Node.js side** (`process-log.js`): dùng CommonJS (`require`), không dùng ES module — chạy bằng `node`, không phải k6
- **k6 log format**: `--log-output=file=...` ghi dạng `time="..." level=info msg="..."` — regex `msg="(REQLOG\|[^"]+)"` để extract
- **Separator trong REQLOG**: dùng `|` — nhưng XML response body cũng chứa `|` hiếm. Nếu cần robust hơn, escape `|` trong snippet thành `\|` trước khi log
- **KHÔNG sửa**: `handleSummary`, `options`, `stageMetrics`, `buildCardInfoPayload`, `buildTransactionPayload`
- **`--log` flag**: yarn forward args tự động — `yarn stress-rkcrm-flow-sv2 --log` truyền `--log` vào `run-stress-sv2.sh`. npm cần thêm `--`: `npm run stress-rkcrm-flow-sv2 -- --log`
- **`console.log` luôn emit** trong k6 script bất kể có `--log` hay không — k6 chỉ ghi vào file nếu `--log-output=file=...` được set; nếu không có flag đó thì k6 discard log output (không in ra terminal) — zero overhead
- **Test nhanh có log**: `FLOW_RPS=2 PRE_VUS=5 MAX_VUS=10 DURATION=5s yarn stress-rkcrm-flow-sv2 --log` → kiểm tra `logs/stress-rkcrm-flow-sv2-*.log`
- **Test nhanh không log**: `FLOW_RPS=2 PRE_VUS=5 MAX_VUS=10 DURATION=5s yarn stress-rkcrm-flow-sv2` → không tạo file, chạy nhanh như bình thường
