# PLAN-rkcrm-transaction-flow-stress

> SPEC: `.ai/specs/SPEC-rkcrm-transaction-flow-stress.md`
> Date: 2026-06-17

---

## 1. Files thay đổi

| File | Action | Ghi chú |
|------|--------|---------|
| `k6/k6-rkcrm-flow-stress.js` | Create | Script mới, KHÔNG copy từ file hiện có |
| `package.json` | Modify | Thêm script `stress-rkcrm-flow-sv2` |

---

## 2. Steps (theo thứ tự dependency)

**[K6-01]** Tạo `k6/k6-rkcrm-flow-stress.js`

**Env vars đọc vào:**
```
TARGET_URL       = TARGET_URL_RKCRM_2 từ .env.k6 (truyền qua -e)
COUPON_CODES_FILE = "./cp1.txt"
TERMINAL_TYPE    = "CRM_API"
```

**Custom metrics** (dùng tên riêng per-stage như pattern `k6-rkcrm-cardinfo-stress.js`):
```
flow_completed  → Counter  — số iteration cả 3 bước pass
flow_failed     → Counter  — số iteration có ít nhất 1 bước fail
flow_duration   → Trend    — tổng thời gian 1 iteration (ms)
// Per stage: reqs_s1..s5, latency_s1..s5, failed_s1..s5
```

**Hàm `buildCardInfoPayload(eCode)`:**
```xml
<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<Message Action="Get coupon info" Terminal_Type="{TERMINAL_TYPE}">
<Coupon_ID>{eCode}</Coupon_ID>
</Message>
```

**Hàm `buildTransactionPayload(eCode)`:**
```xml
<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<Message Action="Transaction" Terminal_Type="{TERMINAL_TYPE}" Global_Type="ABC" Unit_ID="1" User_ID="1">
<Transaction>
    <Account_Number>0.0.{eCode.slice(6)}.922001</Account_Number>
    <External_ID>1003249</External_ID>
    <Amount>60000.00</Amount>
    <External_Index>461930</External_Index>
    <External_Date>2026-06-17</External_Date>
    <Transaction_Time>2026-06-17T13:35:13 +07:00</Transaction_Time>
</Transaction>
</Message>
```

**Stages (giống `k6-rkcrm-cardinfo-stress.js`):**
```javascript
const STAGES = [
  { tag: "s1", label: "10->50 iter/s",   start:  0, end:  30, target:  50 },
  { tag: "s2", label: "50->100 iter/s",  start: 30, end:  60, target: 100 },
  { tag: "s3", label: "100->150 iter/s", start: 60, end:  90, target: 150 },
  { tag: "s4", label: "150->200 iter/s", start: 90, end: 120, target: 200 },
  { tag: "s5", label: "200 iter/s hold", start:120, end: 180, target: 200 },
];
```

**`options`:**
```javascript
executor: "ramping-arrival-rate"
startRate: 10, timeUnit: "1s"
preAllocatedVUs: 400, maxVUs: 1000
stages: khớp STAGES trên + cooldown 10s
thresholds: { http_req_failed: ["rate<0.10"] }
```

**`setup()`:** return `{ startTime: Date.now() }`

**`default function(data)`:**
```
1. elapsed = (Date.now() - data.startTime) / 1000
2. stage = STAGES.find(s => elapsed >= s.start && elapsed < s.end)
3. eCode = couponCodes[random]
4. headers = { Content-Type: application/xml, Accept: application/xml }

5. res1 = http.post(TARGET_URL, buildCardInfoPayload(eCode), { headers, tags: {step:"step1"} })
   stageMetrics[stage.tag].reqs.add(1)
   stageMetrics[stage.tag].latency.add(res1.timings.duration)
   if (!check(res1, {"step1 2xx": r => r.status>=200&&r.status<300})):
     stageMetrics[stage.tag].failed.add(1)
     flow_failed.add(1)
     return   ← STOP

6. res2 = http.post(TARGET_URL, buildCardInfoPayload(eCode), { headers, tags: {step:"step2"} })
   stageMetrics[stage.tag].reqs.add(1)
   stageMetrics[stage.tag].latency.add(res2.timings.duration)
   if (!check(res2, {"step2 2xx": ...})):
     stageMetrics[stage.tag].failed.add(1)
     flow_failed.add(1)
     return   ← STOP

7. res3 = http.post(TARGET_URL, buildTransactionPayload(eCode), { headers, tags: {step:"step3"} })
   stageMetrics[stage.tag].reqs.add(1)
   stageMetrics[stage.tag].latency.add(res3.timings.duration)
   if (!check(res3, {"step3 2xx": ...})):
     stageMetrics[stage.tag].failed.add(1)
     flow_failed.add(1)
     return

8. flow_completed.add(1)
   flow_duration.add(res1.timings.duration + res2.timings.duration + res3.timings.duration)
```

**`handleSummary(data)`** — copy pattern từ `k6-rkcrm-cardinfo-stress.js`:
- Header: `FLOW STRESS TEST — BREAKING POINT REPORT`
- Columns: `Stage | Target | Actual | Completed | Avg(ms) | p95(ms) | Fail% | Status`
- `reqs` = `data.metrics["reqs_${stage.tag}"]?.values?.count ?? 0`
- `completed` = `data.metrics["flow_completed"]?.values?.count ?? 0` (aggregate, không per-stage)
- `avg` = `data.metrics["latency_${stage.tag}"]?.values?.avg ?? 0`
- `p95` = `data.metrics["latency_${stage.tag}"]?.values?.["p(95)"] ?? 0`
- `failRate` = `data.metrics["failed_${stage.tag}"]?.values?.rate ?? 0`
- `actualRps` = `reqs / 3 / duration` (chia 3 vì mỗi iteration = 3 requests)
- Status: `failRate > 0.05 → ❌ FAIL`, `failRate > 0 → ⚠️ WARN`, `0 → ✅ OK`

---

**[PKG-01]** Sửa `package.json` — thêm npm script

Thêm sau `"stress-rkcrm-sv1"`:
```json
"stress-rkcrm-flow-sv2": "sh -c 'set -a; . ./k6/.env.k6; set +a; k6 run -e TARGET_URL=\"$TARGET_URL_RKCRM_2\" -e COUPON_CODES_FILE=./cp1.txt -e TERMINAL_TYPE=\"$TERMINAL_TYPE\" ./k6/k6-rkcrm-flow-stress.js'",
```

---

## 3. DI Registration

Không áp dụng — project là k6 scripts.

---

## 4. DB/API/Config changes

Không có. `TARGET_URL_RKCRM_2` và `TERMINAL_TYPE` đã có trong `.env.k6`.

---

## 5. Cursor Notes

> Paste section này vào đầu chat Cursor trước khi `/implement`.

- **Pattern metric per-stage:** copy y hệt từ `k6-rkcrm-cardinfo-stress.js` — tạo `stageMetrics[tag] = { latency, failed, reqs }` object với metric name riêng (`latency_s1`, `failed_s1`, `reqs_s1`...)
- **Pattern handleSummary:** copy từ `k6-rkcrm-cardinfo-stress.js` — metric lookup key là `data.metrics["latency_s1"]` (không dùng tag sub-metric)
- **`actualRps` trong flow script:** = `reqs / 3 / duration` vì 1 iteration = 3 HTTP requests
- **Stop early:** dùng `return` sau khi `flow_failed.add(1)` — k6 `default function` thoát sớm khi return
- **`flow_completed` và `flow_failed`** là Counter toàn bộ, không per-stage — chỉ dùng để tính tổng
- **KHÔNG sửa:** `k6-rkcrm-cardinfo-stress.js`, `k6-rkcrm-cardinfo.js`, `k6-rkcrm-transaction.js`, `run.sh`
- **`setup()` dùng `Date.now()`** — hợp lệ trong k6 runtime (khác workflow scripts)
- **Tên metric `failed_s1`** là `Rate` — `.values.rate` trả về 0.0–1.0, nhân 100 để ra %
