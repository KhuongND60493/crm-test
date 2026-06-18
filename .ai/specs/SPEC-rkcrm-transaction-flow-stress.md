# SPEC-rkcrm-transaction-flow-stress

**Status:** Draft
**Created:** 2026-06-17
**Author:** AI-assisted (ROMIO Workflow)
**Source:** Requirement Summary from /ask phase

---

## 1. Goal

Stress test luồng transaction thực tế của rkCRM trên sv2: mỗi e-code trải qua đúng 3 bước tuần tự (`getCardInfo` × 2 → `TransactionEx`) để tìm breaking point — mức tải nào server bắt đầu degradation hoặc fail.

---

## 2. Background / Context

Các script load test hiện tại (`k6-rkcrm-cardinfo.js`, `k6-rkcrm-transaction.js`) test từng API độc lập. Thực tế một giao dịch CRM luôn cần 2 lần `getCardInfo` trước khi gọi `TransactionEx` trên cùng 1 e-code. Cần mô phỏng đúng luồng này để đánh giá throughput thực tế của toàn bộ flow, không chỉ từng bước riêng lẻ.

---

## 3. Current Behavior

Chưa có kịch bản test luồng tuần tự 3 bước. Chưa được implement.

---

## 4. Expected Behavior

1. Developer chạy `yarn stress-rkcrm-flow-sv2`
2. k6 tăng dần số luồng đồng thời theo bậc thang (ramping-arrival-rate)
3. Mỗi iteration: lấy 1 e-code random từ `cp1.txt`
4. Gọi `getCardInfo` lần 1 → chờ response
   - Nếu fail (non-2xx hoặc timeout) → dừng iteration, ghi nhận fail, không gọi tiếp
5. Gọi `getCardInfo` lần 2 với cùng e-code → chờ response
   - Nếu fail → dừng iteration, ghi nhận fail
6. Gọi `TransactionEx` với cùng e-code → chờ response
   - Nếu fail → ghi nhận fail
7. Nếu cả 3 bước thành công → ghi nhận 1 flow hoàn chỉnh
8. Cuối test: in breaking point report — từng stage: target RPS, actual RPS, latency, fail rate

---

## 5. Business Rules

- **BR-1:** Cùng 1 e-code dùng xuyên suốt cả 3 bước trong 1 iteration
- **BR-2:** 3 bước bắt buộc theo thứ tự: `getCardInfo` (lần 1) → `getCardInfo` (lần 2) → `TransactionEx`
- **BR-3:** Nếu bất kỳ bước nào fail (non-2xx hoặc timeout) → dừng ngay, không gọi bước tiếp theo
- **BR-4:** Chỉ test sv2 (`TARGET_URL_RKCRM_2`)
- **BR-5:** RPS = số iteration (luồng hoàn chỉnh) khởi động mỗi giây — mỗi iteration sinh ra tối đa 3 HTTP request
- **BR-6:** Là stress test — dùng `ramping-arrival-rate`, tăng dần theo stages
- **BR-7:** Đo latency riêng cho từng bước và tổng cả chuỗi
- **BR-8:** Không retry khi bước fail
- **BR-9:** `getCardInfo` dùng XML format `Action="Get coupon info"` như `k6-rkcrm-cardinfo.js`
- **BR-10:** `TransactionEx` dùng XML format `Action="Transaction"` như `k6-rkcrm-transaction.js` — `Account_Number = 0.0.{eCode.slice(6)}.922001`
- **BR-11:** `TERMINAL_TYPE` lấy từ `.env.k6`

---

## 6. System Flow

```
Developer
  → yarn stress-rkcrm-flow-sv2
  → sh -c source .env.k6 → k6 run k6-rkcrm-flow-stress.js
      - open(cp1.txt) → couponCodes[]
      - ramping-arrival-rate: tăng từ 10 → 200 iter/s theo stages
      Mỗi iteration:
        - random eCode từ couponCodes[]
        - POST getCardInfo (lần 1) → TARGET_URL_RKCRM_2
            fail? → record step1_failed, stop
        - POST getCardInfo (lần 2) → TARGET_URL_RKCRM_2
            fail? → record step2_failed, stop
        - POST TransactionEx → TARGET_URL_RKCRM_2
            fail? → record step3_failed
            success? → record flow_completed
  → handleSummary: breaking point report per stage
```

---

## 7. Input / Output

### Input — env vars (`.env.k6`)

| Variable | Mục đích | Required |
|----------|----------|----------|
| `TARGET_URL_RKCRM_2` | URL sv2 | Có |
| `TERMINAL_TYPE` | Terminal type XML | Có (default `CRM_API`) |
| `COUPON_CODES_FILE` | Path file e-code | Không (default `./cp1.txt`) |

### XML Payloads

**getCardInfo** (dùng cho cả bước 1 và 2):
```xml
<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<Message Action="Get coupon info" Terminal_Type="{TERMINAL_TYPE}">
<Coupon_ID>{eCode}</Coupon_ID>
</Message>
```

**TransactionEx**:
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

### Output — Breaking Point Report (per stage)

| Column | Mô tả |
|--------|-------|
| Stage | Tên stage (ví dụ `10->50 iter/s`) |
| Target | Số iteration/giây mục tiêu |
| Actual | Số iteration/giây thực tế |
| Completed | Số flow hoàn chỉnh (cả 3 bước pass) |
| Avg(ms) | Latency trung bình toàn chuỗi |
| p95(ms) | p95 latency toàn chuỗi |
| Fail% | Tỉ lệ iteration có ít nhất 1 bước fail |
| Status | ✅ OK / ⚠️ WARN / ❌ FAIL |

---

## 8. Affected Modules

- [ ] `k6/k6-rkcrm-flow-stress.js` — **tạo mới**
- [ ] `package.json` — thêm script `stress-rkcrm-flow-sv2`

---

## 9. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| `cp1.txt` rỗng | k6 throw error trước khi chạy |
| Bước 1 fail | Không gọi bước 2 và 3, ghi nhận `step1_failed` |
| Bước 2 fail | Không gọi bước 3, ghi nhận `step2_failed` |
| Bước 3 fail | Ghi nhận `step3_failed`, không ảnh hưởng bước trước |
| `TARGET_URL_RKCRM_2` chưa set | k6 dùng fallback default URL, warn trong output |
| Server timeout (>30s) | k6 tính là fail, iteration dừng |

---

## 10. Acceptance Criteria

- [ ] **AC-1:** `yarn stress-rkcrm-flow-sv2` chạy được, gửi đúng 3 request tuần tự cho mỗi e-code đến sv2
- [ ] **AC-2:** Nếu bước 1 fail, bước 2 và 3 không được gọi (xác nhận qua log hoặc request count)
- [ ] **AC-3:** Cùng 1 e-code được dùng cho cả 3 bước trong 1 iteration
- [ ] **AC-4:** `Account_Number` trong `TransactionEx` đúng format `0.0.{eCode.slice(6)}.922001`
- [ ] **AC-5:** Cuối test in breaking point report với từng stage, có cột Actual RPS và Fail%
- [ ] **AC-6:** Stage có `fail% > 5%` hiện `❌ FAIL`, `> 0%` hiện `⚠️ WARN`, `0%` hiện `✅ OK`

---

## 11. Out of Scope

- Không test sv1
- Không dual-server mode
- Không retry khi bước fail
- Không thay đổi `k6-rkcrm-cardinfo.js`, `k6-rkcrm-transaction.js`, hay các script hiện có
- Không random `Amount`, `External_ID`, `External_Index` trong TransactionEx

---

## 12. Open Questions

| # | Question | Impact if Wrong |
|---|----------|-----------------|
| 1 | `getCardInfo` lần 1 và lần 2 có payload giống nhau hoàn toàn không, hay có tham số nào khác nhau? | Nếu khác nhau cần 2 hàm build payload riêng |
| 2 | API `TransactionEx` có reject duplicate `External_ID="1003249"` gửi liên tục không? | Nếu có → step3 sẽ luôn fail, breaking point report sai |
| 3 | Stages ramping mong muốn là gì? (giữ nguyên 10→50→100→150→200 như `k6-rkcrm-cardinfo-stress.js` hay khác?) | Ảnh hưởng đến phạm vi stress test |
