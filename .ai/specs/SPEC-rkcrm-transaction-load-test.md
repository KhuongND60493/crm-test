# SPEC-rkcrm-transaction-load-test

**Status:** Draft
**Created:** 2026-06-17
**Author:** AI-assisted (ROMIO Workflow)
**Source:** Requirement Summary from /ask phase

---

## 1. Goal

Tạo kịch bản load test cho API `Transaction` của rkCRM, hỗ trợ chia tải giữa 2 server theo tỉ lệ — giúp đánh giá throughput và breaking point của API ghi transaction thực tế.

---

## 2. Background / Context

Hiện tại repo đã có load test cho `Get coupon info` (`k6-rkcrm-cardinfo.js`) và `Get card info` (`k6-rkcrm-cardholder.js`). Cần bổ sung test cho API **Transaction** (ghi điểm/thanh toán) vì đây là API write quan trọng hơn về mặt tải thực tế. Pattern dual-server (`TARGET_URL_RKCRM` / `TARGET_URL_RKCRM_2`) đã được implement và cần tái sử dụng.

---

## 3. Current Behavior

Không có kịch bản load test cho `Action="Transaction"`. Chưa được implement.

---

## 4. Expected Behavior

1. Developer chạy: `yarn test-rkcrm-transaction` hoặc `yarn test-rkcrm-transaction 50 50`
2. Script đọc e-code random từ `cp1.txt`, build `Account_Number = 0.0.{e-code}.922001`
3. Gửi XML POST với payload Transaction cố định đến server được chọn
4. k6 duy trì RPS theo `constant-arrival-rate`
5. Kết quả hiển thị metrics — nếu dual-mode thì tách theo `server:sv1` / `server:sv2`

---

## 5. Business Rules

- **BR-1:** `Account_Number` = `0.0.{e-code}.922001` — `{e-code}` lấy random từ `cp1.txt` mỗi iteration
- **BR-2:** `Terminal_Type` lấy từ env var `TERMINAL_TYPE` (`.env.k6`), default `"CRM_API"`
- **BR-3:** Các field cố định không thay đổi theo runtime:
  - `Action="Transaction"`
  - `Global_Type="ABC"`
  - `Unit_ID="1"`, `User_ID="1"`
  - `External_ID="1003249"`
  - `Amount="60000.00"`
  - `External_Index="461930"`
  - `External_Date="2026-06-17"`
  - `Transaction_Time="2026-06-17T13:35:13 +07:00"`
- **BR-4:** Dual-server mode: truyền `RATIO_1 RATIO_2` (tổng = 100) → chia tải theo tỉ lệ giữa `TARGET_URL_RKCRM` (sv1) và `TARGET_URL_RKCRM_2` (sv2)
- **BR-5:** Single-server mode (không tham số): toàn bộ tải về `TARGET_URL_RKCRM`
- **BR-6:** Validation tham số tỉ lệ giống hệt `run-rkcrm-cardinfo.sh` (số nguyên ≥ 0, tổng = 100, `TARGET_URL_RKCRM_2` phải có)
- **BR-7:** Data file dùng `cp1.txt` (cùng file với cardinfo test)

---

## 6. System Flow

```
Developer
  → yarn test-rkcrm-transaction [RATIO_1] [RATIO_2]
  → run-rkcrm-transaction.sh
      - Validate tham số (nếu có)
      - Resolve TARGET_URL_RKCRM, TARGET_URL_RKCRM_2
      - Export K6_RATIO_1, K6_RATIO_2, TARGET_URL_SV2
  → run.sh → k6 run k6-rkcrm-transaction.js
      - open(cp1.txt) → couponCodes[]
      - Mỗi iteration: random e-code → build Account_Number → build XML
      - POST XML → TARGET_URL (sv1) hoặc TARGET_URL_SV2 (sv2) theo scenario
      - check status 2xx
  → Terminal: metrics (tách sv1/sv2 nếu dual-mode)
```

---

## 7. Input / Output

### Input — tham số shell

| Param | Type | Description | Required | Validation |
|-------|------|-------------|----------|------------|
| `$1` (RATIO_1) | integer | % tải sv1 | Không (bỏ → single mode) | ≥ 0, nguyên |
| `$2` (RATIO_2) | integer | % tải sv2 | Có nếu RATIO_1 truyền | ≥ 0, nguyên; tổng = 100 |

### Input — env vars (`.env.k6`)

| Variable | Mục đích | Required |
|----------|----------|----------|
| `TARGET_URL_RKCRM` | URL sv1 | Có |
| `TARGET_URL_RKCRM_2` | URL sv2 | Khi dual-mode |
| `TERMINAL_TYPE` | Terminal type XML | Có (default `CRM_API`) |
| `RPS`, `PRE_VUS`, `MAX_VUS`, `DURATION` | Load config | Có |

### XML Payload

```xml
<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<Message Action="Transaction" Terminal_Type="{TERMINAL_TYPE}" Global_Type="ABC" Unit_ID="1" User_ID="1">
<Transaction>
    <Account_Number>0.0.{e-code}.922001</Account_Number>
    <External_ID>1003249</External_ID>
    <Amount>60000.00</Amount>
    <External_Index>461930</External_Index>
    <External_Date>2026-06-17</External_Date>
    <Transaction_Time>2026-06-17T13:35:13 +07:00</Transaction_Time>
</Transaction>
</Message>
```

### Output — terminal metrics

| Metric | Dual-mode | Single-mode |
|--------|-----------|-------------|
| `http_reqs` rate | tách `server:sv1` / `server:sv2` | tổng |
| `http_req_duration` p95/p99 | tách theo server | tổng |
| `http_req_failed` rate | tách theo server | tổng |

---

## 8. Affected Modules

- [ ] `k6/k6-rkcrm-transaction.js` — **tạo mới**, copy pattern từ `k6-rkcrm-cardinfo.js`
- [ ] `k6/run-rkcrm-transaction.sh` — **tạo mới**, copy pattern từ `run-rkcrm-cardinfo.sh`
- [ ] `package.json` — thêm script `test-rkcrm-transaction`

---

## 9. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| `cp1.txt` rỗng | k6 throw error trước khi chạy: "No coupon codes found" |
| Không truyền tham số | Single-server, toàn bộ RPS về `TARGET_URL_RKCRM` |
| `0 100` | Chỉ chạy sv2 scenario (sv1 bị skip vì rate=0) |
| `100 0` | Chỉ chạy sv1 scenario |
| `TARGET_URL_RKCRM_2` chưa set khi dual-mode | Báo lỗi rõ, exit 1 |
| Server trả non-2xx | Ghi nhận fail, tiếp tục test |

---

## 10. Acceptance Criteria

- [ ] **AC-1:** `yarn test-rkcrm-transaction` chạy single-server, gửi XML Transaction đúng format đến `TARGET_URL_RKCRM`
- [ ] **AC-2:** `Account_Number` trong mỗi request có format `0.0.{e-code}.922001` với `{e-code}` random từ `cp1.txt`
- [ ] **AC-3:** `yarn test-rkcrm-transaction 50 50` chạy dual-server, metrics tách riêng sv1/sv2
- [ ] **AC-4:** `yarn test-rkcrm-transaction 0 100` gửi toàn bộ tải về sv2, không lỗi k6
- [ ] **AC-5:** Validation tham số sai (tổng ≠ 100, không phải số) → báo lỗi rõ, exit trước khi k6 chạy
- [ ] **AC-6:** `TERMINAL_TYPE` trong XML lấy đúng từ `.env.k6`

---

## 11. Out of Scope

- Không random `Amount`, `External_ID`, `External_Index`
- Không dynamic `External_Date` / `Transaction_Time` theo thời gian thực
- Không thêm stress test script cho transaction
- Không thay đổi `k6-rkcrm-cardinfo.js` hay các script hiện có

---

## 12. Open Questions

| # | Question | Impact if Wrong |
|---|----------|-----------------|
| 1 | `cp1.txt` chứa e-code dạng `0716228080877` — cần confirm định dạng chính xác để build `Account_Number` đúng | Payload sai → API reject toàn bộ request |
| 2 | API Transaction có idempotent không? (cùng `External_ID` gửi nhiều lần có bị reject không?) | Nếu không idempotent → test load sẽ có error rate cao dù server khỏe |
