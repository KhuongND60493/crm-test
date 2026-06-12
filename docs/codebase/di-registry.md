# DI Registry (k6 Environment Config)

> Generated: 2026-06-12
> Re-run: /scan-codebase --section di
> Note: Đây là dự án k6 load test — không có DI container .NET.
> "DI Registry" ở đây là toàn bộ env vars và cách inject vào k6 scripts.

---

## Environment Variable Injection

k6 nhận env qua: `k6 run -e KEY=VALUE script.js` hoặc shell export. `run.sh` source `k6/.env.k6` trước khi gọi k6.

### Load order (ưu tiên cao → thấp)

1. Shell env vars (export hoặc inline `KEY=VALUE bash run.sh`)
2. `.env.k6` (source bởi `run.sh`)
3. Default hardcode trong script

---

## Biến môi trường toàn cục

| Biến | Kiểu | Mặc định | Mô tả |
|------|------|----------|-------|
| `RPS` | number | `200` | Requests per second |
| `DURATION` | string | `2m` | Thời gian test |
| `PRE_VUS` | number | `100` | Pre-allocated VUs |
| `MAX_VUS` | number | `200` | Max VUs |
| `TARGET_URL` | string | `http://192.168.2.104:8100` | Endpoint gốc (legacy/rkCRM) |
| `TARGET_URL_RKCRM` | string | `http://61.28.226.116:9192` | rkCRM staging/prod URL |
| `TARGET_URL_CLOUD` | string | same as above | Alias cloud |
| `TERMINAL_TYPE` | string | `CRM_API` | rkCRM terminal type |
| `COUPON_TXT` | string | `cp1.txt` | File coupon codes (k6-test.js) |
| `CUSTOMER_TXT` | string | `customer-stg.txt` | File customer/card codes |
| `MSSQL_CONNECTION_STRING` | string | (secret) | SQL Server connection — không commit |
| `COUPON_SQL_QUERY` | string | (xem entity-map) | Query lấy coupon từ DB |

---

## Biến theo script

### `k6-rkcrm-cardinfo.js`
| Biến | Alias k6 key | Default |
|------|-------------|---------|
| `RPS` | `K6_RPS` / `RPS` | `10` |
| `DURATION` | `K6_DURATION` / `DURATION` | `30s` |
| `PRE_VUS` | `K6_PRE_VUS` / `PRE_VUS` | `20` |
| `MAX_VUS` | `K6_MAX_VUS` / `MAX_VUS` | `200` |
| `TARGET_URL` | `TARGET_URL` | `http://127.0.0.1:8100` |
| `COUPON_CODES_FILE` | `COUPON_CODES_FILE` | `./coupon-codes.txt` |
| `RKCRM_ACTION` | — | `"Get coupon info"` |
| `TERMINAL_TYPE` | — | `"CRM_DCORP"` |

### `k6-rkcrm-cardholder.js`
| Biến | Default |
|------|---------|
| `RKCRM_CARDHOLDER_ACTION` | `"Get card info"` |
| `RKCRM_GLOBAL_TYPE` | `"kd3ZhhFF4vBllah1UM3R"` |
| `RKCRM_UNIT_ID` | `"1"` |
| `RKCRM_USER_ID` | `"1"` |
| `RKCRM_CARDHOLDER_INCLUDE` | `"Account,Holder_Contact,Holder_Coupon"` |
| `RKCRM_CARD_CODES_FILE` | fallback `COUPON_CODES_FILE` → `./coupon-codes-2-9.txt` |

### `k6-newapp-cardinfo.js`
| Biến | Default |
|------|---------|
| `NEWAPP_CARDS_FILE` | fallback `COUPON_CODES_FILE` → `./coupon-codes-2-9.txt` |
| `NEWAPP_RESTAURANT` | `"1"` |
| `NEWAPP_UNIT_NO` | `"65"` |
| Endpoint | `{TARGET_URL}/getcardinfoex` |

### `k6-api-post-xml.js` (legacy)
| Biến | Default |
|------|---------|
| `PARTNER_CODE` | `"1"` |
| `COUPON_CODES_FILE` | `./coupon-codes.txt` |

---

## Node.js — `fetch-coupons.js`

Dùng `dotenv` để load `.env.k6`, sau đó kết nối SQL Server qua `mssql` package.

| Dependency | Version | Mục đích |
|------------|---------|----------|
| `mssql` | ^11.0.1 | SQL Server driver (Node.js) |

---

## Thêm script mới — checklist

1. Thêm env vars cần thiết vào `k6/.env.k6` (với comment)
2. Tạo `k6/k6-<name>.js` (copy pattern từ `k6-rkcrm-cardinfo.js`)
3. Tạo `k6/run-<name>.sh` — set `TARGET_URL`, `COUPON_CODES_FILE`, `SKIP_COUPON_FETCH=1`, gọi `run.sh`
4. Thêm npm script trong `package.json`
5. Cập nhật `docs/codebase/api-endpoints.md` với target endpoint mới
