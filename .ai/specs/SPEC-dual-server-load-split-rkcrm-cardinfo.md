# SPEC-dual-server-load-split-rkcrm-cardinfo

**Status:** Draft
**Created:** 2026-06-17
**Author:** AI-assisted (ROMIO Workflow)
**Source:** Requirement Summary from /ask phase

---

## 1. Goal

Cho phép `yarn test-rkcrm-cardinfo` nhận tham số tỉ lệ chia tải (ví dụ `50 50`) để phân phối request giữa `TARGET_URL_RKCRM` và `TARGET_URL_RKCRM_2`, với kết quả hiển thị **tách biệt từng server** để đo throughput và latency độc lập.

---

## 2. Background / Context

Hiện tại `run-rkcrm-cardinfo.sh` chỉ test một server duy nhất (`TARGET_URL_RKCRM`). Team cần test kịch bản **chia tải 2 server** để đánh giá khả năng scale-out của rkCRM API — biết server nào nhận bao nhiêu và hiệu quả từng server ra sao.

---

## 3. Current Behavior

- `npm run test-rkcrm-cardinfo` → `run-rkcrm-cardinfo.sh` → `run.sh` → `k6-rkcrm-cardinfo.js`
- Toàn bộ request gửi về **một server duy nhất** (`TARGET_URL_RKCRM`)
- Không có tham số tỉ lệ; không có phân tách kết quả theo server

---

## 4. Expected Behavior

1. Developer chạy: `yarn test-rkcrm-cardinfo 50 50`
2. Shell runner đọc 2 tham số `RATIO_1=50` và `RATIO_2=50`, validate tổng = 100
3. k6 chạy **2 scenarios song song**:
   - `scenario_sv1`: gửi `RPS × RATIO_1 / 100` req/s → `TARGET_URL_RKCRM`
   - `scenario_sv2`: gửi `RPS × RATIO_2 / 100` req/s → `TARGET_URL_RKCRM_2`
4. Kết quả terminal hiển thị metrics **tách riêng** từng server qua tag `server`
5. Nếu một server lỗi/timeout: request đó bị ghi nhận fail, **không failover**, test tiếp tục

---

## 5. Business Rules

- **BR-1:** `RATIO_1 + RATIO_2` phải bằng `100`; nếu không → in thông báo lỗi rõ ràng và exit trước khi gọi k6
- **BR-2:** Mỗi request chỉ gửi đến **một server**; không gửi cả hai cùng lúc
- **BR-3:** Không failover — nếu server lỗi, request đó fail, tỉ lệ phân phối không thay đổi
- **BR-4:** Kết quả hiển thị tách riêng: server 1 và server 2 có req/s, latency, error rate độc lập (dùng k6 `tags` hoặc `groups`)
- **BR-5:** Tỉ lệ là số nguyên dương (không phải thập phân, không âm)
- **BR-6:** Khi **không truyền tham số** tỉ lệ → chạy như cũ (single server, `TARGET_URL_RKCRM`)
- **BR-7:** `TARGET_URL_RKCRM_2` phải được define trong `.env.k6`; nếu thiếu và tỉ lệ được truyền → báo lỗi rõ và exit

---

## 6. System Flow

```
Developer
  → yarn test-rkcrm-cardinfo [RATIO_1] [RATIO_2]
  → run-rkcrm-cardinfo.sh
      - Đọc $1, $2 (tỉ lệ)
      - Validate: số nguyên, tổng = 100, TARGET_URL_RKCRM_2 tồn tại
      - Tính RPS_1 = RPS × RATIO_1 / 100
      - Tính RPS_2 = RPS × RATIO_2 / 100
      - Export K6_RATIO_1, K6_RATIO_2, TARGET_URL_RKCRM_2
  → run.sh → k6 run k6-rkcrm-cardinfo.js
      - Nếu K6_RATIO_1 / K6_RATIO_2 có giá trị: chạy 2 scenarios
      - Nếu không: chạy 1 scenario (backward-compatible)
  → k6 scenario_sv1: constant-arrival-rate → TARGET_URL_RKCRM (tag server=sv1)
  → k6 scenario_sv2: constant-arrival-rate → TARGET_URL_RKCRM_2 (tag server=sv2)
  → Terminal: metrics tách biệt theo tag server
```

---

## 7. Input / Output

### Input — tham số shell

| Param | Type | Description | Required | Validation |
|-------|------|-------------|----------|------------|
| `$1` (RATIO_1) | integer | % tải gửi về server 1 | Không (nếu bỏ → single-server mode) | 1–99, số nguyên |
| `$2` (RATIO_2) | integer | % tải gửi về server 2 | Có (nếu RATIO_1 được truyền) | 1–99, số nguyên; RATIO_1 + RATIO_2 = 100 |

### Input — env vars (`.env.k6`)

| Variable | Mục đích | Required khi dual-server |
|----------|----------|--------------------------|
| `TARGET_URL_RKCRM` | URL server 1 | Có |
| `TARGET_URL_RKCRM_2` | URL server 2 | Có |
| `RPS` | Tổng request/giây | Có |
| `PRE_VUS`, `MAX_VUS`, `DURATION` | Load config | Có |

### Output — terminal k6 metrics

| Metric | Hiển thị theo | Ghi chú |
|--------|--------------|---------|
| `http_reqs` rate | tag `server=sv1` / `server=sv2` | req/s từng server |
| `http_req_duration` (avg, p95, p99) | tag `server` | latency từng server |
| `http_req_failed` rate | tag `server` | error rate từng server |
| `dropped_iterations` | scenario | bao nhiêu iter bị drop |

---

## 8. Affected Modules

- [ ] `k6/run-rkcrm-cardinfo.sh` — thêm đọc + validate tham số `$1 $2`, export env cho k6
- [ ] `k6/k6-rkcrm-cardinfo.js` — thêm conditional dual-scenario khi nhận `K6_RATIO_1` / `K6_RATIO_2`
- [ ] `k6/.env.k6` — thêm `TARGET_URL_RKCRM_2` (đã có theo user, chỉ cần document)

---

## 9. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Không truyền tham số | Chạy single-server như cũ (backward-compatible) |
| Truyền `70 30` → tổng = 100 | Hợp lệ, chạy dual-server |
| Truyền `60 50` → tổng = 110 | Báo lỗi: "RATIO_1 + RATIO_2 phải = 100", exit 1 |
| Truyền `0 100` | Báo lỗi: ratio phải là số nguyên dương (> 0) |
| Truyền chỉ 1 tham số | Báo lỗi: phải truyền đủ 2 tham số hoặc không truyền gì |
| `TARGET_URL_RKCRM_2` chưa set trong `.env.k6` | Báo lỗi: "TARGET_URL_RKCRM_2 chưa được cấu hình", exit 1 |
| Server 2 down trong lúc test | Requests đến sv2 fail, ghi nhận lỗi, test tiếp tục bình thường |
| `RPS × RATIO / 100` ra số lẻ | Làm tròn xuống (floor); tổng có thể < RPS 1-2 req |

---

## 10. Acceptance Criteria

- [ ] **AC-1:** `yarn test-rkcrm-cardinfo 50 50` chạy thành công với 2 scenarios song song, mỗi scenario nhận ~50% RPS
- [ ] **AC-2:** Terminal output hiển thị metrics tách riêng cho `server=sv1` và `server=sv2`
- [ ] **AC-3:** `yarn test-rkcrm-cardinfo` (không tham số) vẫn chạy đúng như cũ — single server, không lỗi
- [ ] **AC-4:** Truyền tỉ lệ không hợp lệ (tổng ≠ 100) → in thông báo lỗi rõ và exit trước khi k6 chạy
- [ ] **AC-5:** Truyền tỉ lệ hợp lệ nhưng `TARGET_URL_RKCRM_2` chưa set → in thông báo lỗi và exit
- [ ] **AC-6:** Nếu một server lỗi, request đó bị ghi nhận fail, server còn lại tiếp tục nhận tải theo tỉ lệ ban đầu (không redistribute)

---

## 11. Out of Scope

- Không hỗ trợ > 2 servers trong feature này
- Không failover (redistribute tải khi 1 server down)
- Không thay đổi logic scenario của `k6-rkcrm-cardholder.js` hay `k6-newapp-cardinfo.js`
- Không thay đổi Grafana dashboard (`dashboard.json`)
- Không thay đổi `fetch-coupons.js` hay data prep flow

---

## 12. Open Questions

| # | Question | Impact if Wrong |
|---|----------|-----------------|
| 1 | `run.sh` hiện dùng `unset RPS DURATION PRE_VUS MAX_VUS` — khi dual scenario cần 2 giá trị RPS riêng, cách pass qua `run.sh` có conflict không? | Có thể cần bypass `run.sh` hoặc sửa cách truyền env |
| 2 | k6 `constant-arrival-rate` với 2 scenarios dùng chung `PRE_VUS`/`MAX_VUS` hay mỗi scenario config độc lập? | Ảnh hưởng VU allocation — cần test thực tế |
