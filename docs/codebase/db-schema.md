# Database Schema (External — SQL Server)

> Generated: 2026-06-12
> Re-run: /scan-codebase --section schema
> Note: Đây là dự án k6 load test. Không có migration EF Core.
> Schema dưới đây là DB **nguồn dữ liệu test** (SQL Server external), không phải DB của app.

---

## Kết nối

| Môi trường | Server | Database |
|-----------|--------|----------|
| Dev | `192.168.2.9:1433` | `DEV_CRM` |
| Staging | `180.93.183.182:1433` | `R_KEEPER_7_CRM_VTI` |
| Auth | `User Id=rk7` | credentials trong `.env.k6` (không commit) |

---

## Bảng `CARD_COUPONS`

Bảng duy nhất được query bởi `fetch-coupons.js` để lấy input data cho k6.

| Column | Kiểu | Nullable | Ghi chú |
|--------|------|----------|---------|
| `COUPON_CODE` | varchar/nvarchar | NO | Mã coupon — cột chính được dùng |
| `DELETED` | bit/int | — | Filter `DELETED = 0` |
| *(các cột khác)* | — | — | Không dùng trong load test |

**Query mặc định:**
```sql
SELECT COUPON_CODE FROM CARD_COUPONS
WHERE COUPON_CODE IS NOT NULL
  AND LTRIM(RTRIM(COUPON_CODE)) <> ''
  AND DELETED = 0
```
Override qua env `COUPON_SQL_QUERY`.

**Output:** File text, mỗi dòng một mã coupon → dùng làm input cho k6 scripts.

---

## Cách refresh data

```bash
# Lấy coupon codes mới từ SQL Server
npm run fetch-coupons
# → output: COUPON_CODES_FILE (mặc định k6/coupon-codes.txt)

# Hoặc chạy thủ công với env tùy chỉnh
MSSQL_CONNECTION_STRING="..." COUPON_CODES_FILE="./k6/my-codes.txt" node k6/fetch-coupons.js
```

**Lưu ý:** `run.sh` mặc định set `SKIP_COUPON_FETCH=1` — không auto-query DB. Phải chạy `fetch-coupons` thủ công khi cần refresh.

---

## Target API Databases (external, không query trực tiếp)

| System | DB backend | Ghi chú |
|--------|-----------|---------|
| rkCRM | SQL Server (nội bộ) | API XML trên port 9192 |
| NewApp | (unknown) | REST endpoint `/getcardinfoex` |
| Legacy MCR coupon | SQL Server (nội bộ) | XML API port 8100 |

Load test chỉ gọi HTTP — không connect trực tiếp vào các DB này.
