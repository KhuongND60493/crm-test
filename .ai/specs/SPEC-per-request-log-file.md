# SPEC-per-request-log-file

**Status:** Draft
**Created:** 2026-06-18
**Author:** AI-assisted (ROMIO Workflow)
**Source:** Requirement Summary from /ask phase

---

## 1. Goal

Ghi log chi tiết từng HTTP request trong quá trình chạy `stress-rkcrm-flow-sv2` ra file text,
giúp engineer phân tích từng request theo eCode/step sau khi test hoàn thành.

## 2. Background / Context

Hiện tại `k6-rkcrm-flow-stress.js` chỉ xuất aggregate summary ra terminal khi test kết thúc.
Không có cách nào truy vết một request cụ thể (eCode nào bị fail ở step nào, response body lúc đó là gì).
Feature này bổ sung per-request logging ra file để phục vụ debug và phân tích sau test.

## 3. Current Behavior

- `handleSummary()` in terminal aggregate metrics (flow overview + step breakdown)
- Không có file log nào được ghi ra disk
- Không lưu thông tin per-request (eCode, timestamp, response body)

## 4. Expected Behavior

1. Khi k6 bắt đầu chạy, tạo file log tại `logs/stress-rkcrm-flow-sv2-{dd-MM-yyyy-HHmmss}.log`
2. Mỗi khi một HTTP request hoàn thành (bất kể pass/fail), ghi 1 dòng log vào file
3. Sau khi test kết thúc, file log chứa đầy đủ tất cả request đã gửi
4. Terminal summary hiện tại (handleSummary) vẫn hoạt động bình thường, không thay đổi

## 5. Business Rules

- **BR-1:** Mỗi request = đúng 1 dòng log, không gộp, không bỏ sót
- **BR-2:** Format mỗi dòng:
  ```
  {ISO8601 UTC} | {step_name} | eCode={value} | sent={epoch_ms} | recv={epoch_ms} | {duration_ms}ms | {PASS|FAIL} | {response_body_100chars}
  ```
  Ví dụ:
  ```
  2026-06-18T07:30:22.123Z | step1 | eCode=CP000123456 | sent=1750232822000 | recv=1750232822245 | 245ms | PASS | <?xml version="1.0"?><Message><Result>OK</Result><Coupon_ID>CP00012
  2026-06-18T07:30:22.370Z | step1 | eCode=CP000789012 | sent=1750232822350 | recv=1750232822370 | 20ms  | FAIL | (timeout)
  ```
- **BR-3:** `response_body_100chars` = `res.body` sau khi trim, cắt còn 100 ký tự. Nếu body rỗng hoặc null → ghi `(empty)`. Nếu timeout (status=0, body=null) → ghi `(timeout)`
- **BR-4:** `sent` = timestamp trước khi gọi `http.post`. `recv` = timestamp sau khi `http.post` trả về
- **BR-5:** Tên file timestamp lấy lúc **bắt đầu chạy test** (trong `setup()`), không phải lúc request
- **BR-6:** File lưu tại `{project_root}/logs/` — tạo thư mục nếu chưa tồn tại
- **BR-7:** Mỗi lần chạy test tạo file mới (không append vào file cũ cùng tên)
- **BR-8:** Ghi log cho cả 3 step (step1, step2, step3), kể cả khi step fail và flow dừng sớm

## 6. System Flow

```
k6 runner (constant-arrival-rate)
  → setup() — tạo tên file log từ timestamp, truyền qua data object
  → default function (per iteration)
      → ghi pre-request timestamp (sent)
      → http.post step1
      → ghi post-request timestamp (recv), build log line
      → open(logFile, 'a').write(logLine)   [k6 file append]
      → nếu ok1: tiếp tục step2, step3 (tương tự)
      → nếu !ok1: ghi log FAIL, return sớm
  → handleSummary() — xuất terminal summary như hiện tại (không đổi)
```

## 7. Input / Output

### Input (runtime variables — không thay đổi)

| Field | Source | Description |
|-------|--------|-------------|
| `eCode` | `cp1.txt` random | Coupon code dùng cho request |
| `TARGET_URL` | `__ENV.TARGET_URL` | Endpoint rkCRM |
| `FLOW_RPS` | `__ENV.FLOW_RPS` | Target RPS |
| `DURATION` | `__ENV.DURATION` | Thời gian test |

### Output — Log file

**Tên file:** `logs/stress-rkcrm-flow-sv2-{dd-MM-yyyy-HHmmss}.log`

**Mỗi dòng:**

| Field | Type | Ví dụ |
|-------|------|-------|
| ISO8601 timestamp | string | `2026-06-18T07:30:22.123Z` |
| step name | string | `step1`, `step2`, `step3` |
| eCode | string | `eCode=CP000123456` |
| sent | epoch ms | `sent=1750232822000` |
| recv | epoch ms | `recv=1750232822245` |
| duration | number + "ms" | `245ms` |
| result | enum | `PASS` hoặc `FAIL` |
| response snippet | string (max 100 chars) | first 100 chars of `res.body` |

## 8. Affected Modules

- [x] `k6/k6-rkcrm-flow-stress.js` — file duy nhất cần sửa
- [ ] `logs/` — thư mục mới, cần tạo (hoặc tạo programmatic trong setup)

## 9. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Request timeout (status=0, body=null) | result=`FAIL`, body snippet=`(timeout)` |
| Response body rỗng (status 2xx, body="") | result=`PASS`, body snippet=`(empty)` |
| Response body < 100 ký tự | Ghi toàn bộ, không pad |
| Response body > 100 ký tự | Cắt đúng 100 ký tự (không cắt giữa entity XML) |
| Flow dừng ở step1 (fail) | step1 có log FAIL, step2/step3 không có dòng |
| Thư mục `logs/` chưa tồn tại | k6 tự tạo qua `open()` hoặc mkdir trong setup |
| Nhiều VU ghi đồng thời | k6 `open()` với mode append — k6 handle thread-safety nội bộ |
| `DURATION` rất dài, file log rất lớn | Không xử lý — out of scope |

## 10. Acceptance Criteria

- [ ] **AC-1:** Sau khi chạy `yarn stress-rkcrm-flow-sv2`, file `logs/stress-rkcrm-flow-sv2-*.log` tồn tại
- [ ] **AC-2:** File chứa ít nhất `FLOW_RPS × parseFloat(DURATION)` dòng log (tương ứng số flow hoàn thành × số step)
- [ ] **AC-3:** Mỗi dòng có đủ 8 trường phân cách bằng ` | `
- [ ] **AC-4:** Dòng cho request fail có `FAIL` và body snippet phù hợp (`(timeout)` hoặc nội dung thực)
- [ ] **AC-5:** Body snippet không vượt quá 100 ký tự
- [ ] **AC-6:** Terminal summary sau test vẫn hiển thị đúng như trước (không regression)
- [ ] **AC-7:** Timestamp trong tên file khớp với thời điểm bắt đầu test (±5 giây)
- [ ] **AC-8:** Chạy 2 lần liên tiếp → tạo 2 file log khác tên (không ghi đè)

## 11. Out of Scope

- Không lưu full response body (chỉ 100 ký tự đầu)
- Không áp dụng cho các script k6 khác (`k6-rkcrm-cardinfo.js`, `k6-newapp-cardinfo.js`, v.v.)
- Không rotate, compress, hay cleanup log file cũ
- Không stream log đến external system (Grafana, ELK, v.v.)
- Không thêm log cho `handleSummary` output

## 12. Open Questions

| # | Question | Impact if Wrong |
|---|----------|-----------------|
| 1 | k6 `open()` có hỗ trợ append mode (`'a'`) cho concurrent writes không? Nếu không, cần dùng `SharedArray` hoặc output plugin thay thế | Nếu không hỗ trợ, cần đổi approach sang `--out csv` hoặc custom output |
| 2 | Thư mục `logs/` có nên add vào `.gitignore` không? | Nếu không, log file sẽ bị track vào git |
