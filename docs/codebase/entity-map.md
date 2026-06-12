# Entity Map (k6 Data Models)

> Generated: 2026-06-12
> Re-run: /scan-codebase --section entities
> Note: Đây là dự án k6 load test — không có domain entity .NET.
> "Entities" ở đây là các data model / input data mà k6 scripts sử dụng.

---

## Input Data Files

| File | Loại mã | Dùng bởi script | Kích thước ước lượng |
|------|---------|-----------------|----------------------|
| `k6/cp1.txt` | Coupon codes (bulk) | `k6-api-post-xml.js`, `k6-rkcrm-cardinfo.js` | ~1M dòng |
| `k6/customer-stg.txt` | Card/Customer codes (staging) | `k6-rkcrm-cardholder.js`, `k6-newapp-cardinfo.js` | ~43 dòng |
| `coupon-codes.txt` (generated) | Coupon codes từ SQL Server | mọi script qua `COUPON_CODES_FILE` | dynamic |

---

## XML Payload Schemas (per scenario)

### CouponXmlPayload — Legacy MCR
- **Script:** `k6/k6-api-post-xml.js`
- **Fields:**
  | Field | Env var nguồn | Default |
  |-------|---------------|---------|
  | `Coupon_ID` | random từ `COUPON_CODES_FILE` | — |
  | `Partner_Code` | `PARTNER_CODE` | `"1"` |
- **XML shape:**
  ```xml
  <Message>
    <Coupon_ID>{couponCode}</Coupon_ID>
    <Partner_Code>{partnerCode}</Partner_Code>
  </Message>
  ```

### RkCrmCouponInfoPayload — rkCRM Get coupon info
- **Script:** `k6/k6-rkcrm-cardinfo.js`
- **Fields:**
  | Field | Env var nguồn | Default |
  |-------|---------------|---------|
  | `Action` (attr) | `RKCRM_ACTION` | `"Get coupon info"` |
  | `Terminal_Type` (attr) | `TERMINAL_TYPE` | `"CRM_DCORP"` |
  | `Coupon_ID` | random từ `COUPON_CODES_FILE` | — |
- **XML shape:**
  ```xml
  <Message Action="{action}" Terminal_Type="{terminalType}">
    <Coupon_ID>{couponCode}</Coupon_ID>
  </Message>
  ```

### RkCrmCardholderPayload — rkCRM Get card info
- **Script:** `k6/k6-rkcrm-cardholder.js`
- **Fields:**
  | Field | Env var nguồn | Default |
  |-------|---------------|---------|
  | `Action` (attr) | `RKCRM_CARDHOLDER_ACTION` | `"Get card info"` |
  | `Terminal_Type` (attr) | `TERMINAL_TYPE` | `"CRM_DCORP"` |
  | `Global_Type` (attr) | `RKCRM_GLOBAL_TYPE` | `"kd3ZhhFF4vBllah1UM3R"` |
  | `Unit_ID` (attr) | `RKCRM_UNIT_ID` | `"1"` |
  | `User_ID` (attr) | `RKCRM_USER_ID` | `"1"` |
  | `Card_Code` | random từ `RKCRM_CARD_CODES_FILE` / `COUPON_CODES_FILE` | — |
  | `Include` | `RKCRM_CARDHOLDER_INCLUDE` | `"Account,Holder_Contact,Holder_Coupon"` |
- **XML shape:**
  ```xml
  <Message Action="{action}" Terminal_Type="{type}" Global_Type="{gt}" Unit_ID="{uid}" User_ID="{user}">
    <Card_Code>{cardCode}</Card_Code>
    <Include>{include}</Include>
  </Message>
  ```

### NewAppCardInfoPayload — NewApp /getcardinfoex
- **Script:** `k6/k6-newapp-cardinfo.js`
- **Fields:**
  | Field | Env var nguồn | Default |
  |-------|---------------|---------|
  | `Card` (attr) | random từ `NEWAPP_CARDS_FILE` / `COUPON_CODES_FILE` | — |
  | `Restaurant` (attr) | `NEWAPP_RESTAURANT` | `"1"` |
  | `UnitNo` (attr) | `NEWAPP_UNIT_NO` | `"65"` |
- **XML shape:**
  ```xml
  <ROOT>
    <QRY Card="{card}" Restaurant="{restaurant}" UnitNo="{unitNo}">
    </QRY>
  </ROOT>
  ```

---

## Shared Utility: `k6/src/utils.js`

### `getEnv(env)`
Parses `__ENV` (k6 environment) → returns typed config object.
- Input: `__ENV` object (k6 global)
- Output: `{ TEST_NAME, SV, TARGET_URL, RPS, DURATION, PRE_VUS, MAX_VUS, PARTNER_CODE, COUPON_CODES_FILE, CUSTOMER_CODES_FILE }`

### `getCouponCodes(filePath)`
Reads a `.txt` file (via k6 `open()`), splits by newline, trims, filters empty.
- Input: file path string
- Output: `string[]` (throws if empty)

---

## SQL Server Schema (nguồn dữ liệu — external)

- **Server:** `192.168.2.9:1433` (dev) / `180.93.183.182:1433` (staging)
- **Database:** `DEV_CRM` (dev) / `R_KEEPER_7_CRM_VTI` (staging)
- **Table:** `CARD_COUPONS`
- **Column used:** `COUPON_CODE`
- **Query:**
  ```sql
  SELECT COUPON_CODE FROM CARD_COUPONS
  WHERE COUPON_CODE IS NOT NULL
    AND LTRIM(RTRIM(COUPON_CODE)) <> ''
    AND DELETED = 0
  ```
