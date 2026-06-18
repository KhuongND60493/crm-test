# PLAN-rkcrm-transaction-load-test

> SPEC: `.ai/specs/SPEC-rkcrm-transaction-load-test.md`
> Date: 2026-06-17

---

## 1. Files thay đổi

| File | Action | Ghi chú |
|------|--------|---------|
| `k6/k6-rkcrm-transaction.js` | Create | Copy pattern từ `k6-rkcrm-cardinfo.js` |
| `k6/run-rkcrm-transaction.sh` | Create | Copy pattern từ `run-rkcrm-cardinfo.sh` |
| `package.json` | Modify | Thêm script `test-rkcrm-transaction` |

---

## 2. Steps (theo thứ tự dependency)

**[K6-01]** Tạo `k6/k6-rkcrm-transaction.js`

Copy toàn bộ structure từ `k6-rkcrm-cardinfo.js`, thay đổi:

- Env vars đọc vào:
  ```
  TARGET_URL, TARGET_URL_SV2, RPS, DURATION, PRE_VUS, MAX_VUS
  COUPON_CODES_FILE (default "./cp1.txt")
  TERMINAL_TYPE (default "CRM_API")
  K6_RATIO_1, K6_RATIO_2
  ```

- Hàm `buildXmlPayload(eCode)` tạo XML:
  ```xml
  <?xml version="1.0" encoding="utf-8" standalone="yes" ?>
  <Message Action="Transaction" Terminal_Type="{TERMINAL_TYPE}" Global_Type="ABC" Unit_ID="1" User_ID="1">
  <Transaction>
      <Account_Number>0.0.{eCode}.922001</Account_Number>
      <External_ID>1003249</External_ID>
      <Amount>60000.00</Amount>
      <External_Index>461930</External_Index>
      <External_Date>2026-06-17</External_Date>
      <Transaction_Time>2026-06-17T13:35:13 +07:00</Transaction_Time>
  </Transaction>
  </Message>
  ```

- `options` conditional dual/single — giống hệt `k6-rkcrm-cardinfo.js` (`buildDualScenarios()`)

- Scenario names: `rkcrm_transaction_sv1`, `rkcrm_transaction_sv2`, `rkcrm_transaction_load`

- `default function`: chọn URL theo `scenario.name`, random e-code từ `couponCodes[]`, gọi `buildXmlPayload(eCode)`, POST, check 2xx

- Tags: `{ api: "rkcrm_transaction_post" }`

---

**[SH-01]** Tạo `k6/run-rkcrm-transaction.sh`

Copy toàn bộ từ `run-rkcrm-cardinfo.sh`, chỉ thay:
- Biến `RKCRM_URL` đọc từ `TARGET_URL_RKCRM` (giữ nguyên)
- Script target: `"${SCRIPT_DIR}/k6-rkcrm-transaction.js"` (thay vì `k6-rkcrm-cardinfo.js`)
- `COUPON_CODES_FILE` vẫn dùng `"${SCRIPT_DIR}/cp1.txt"`

---

**[PKG-01]** Sửa `package.json` — thêm npm script

Thêm sau dòng `"test-rkcrm-cardholder"`:
```json
"test-rkcrm-transaction": "bash ./k6/run-rkcrm-transaction.sh",
```

---

## 3. DI Registration

Không áp dụng — project là k6 shell scripts.

---

## 4. DB/API/Config changes

Không có DB migration, API endpoint mới, hay config key mới.

`TARGET_URL_RKCRM` và `TARGET_URL_RKCRM_2` đã có sẵn trong `.env.k6`.

---

## 5. Cursor Notes

> Paste section này vào đầu chat Cursor trước khi `/implement`.

- **Pattern:** copy `k6/k6-rkcrm-cardinfo.js` làm base — chỉ thay `buildXmlPayload`, scenario names, và tag `api`
- **Shell pattern:** copy `k6/run-rkcrm-cardinfo.sh` — chỉ thay tên script target
- **Account_Number format:** `0.0.${eCode.slice(6)}.922001` — bỏ 6 ký tự đầu của mỗi dòng `cp1.txt` (ví dụ `9220017980524122084` → `7980524122084`)
- **Giữ nguyên `buildDualScenarios()`** — copy y hệt từ cardinfo, chỉ đổi tên scenario
- **KHÔNG sửa:** `k6-rkcrm-cardinfo.js`, `run-rkcrm-cardinfo.sh`, `run.sh`, `.env.k6`
- **Scenario names phải khác** với cardinfo để k6 không conflict khi chạy song song: dùng `rkcrm_transaction_sv1/sv2/load`
