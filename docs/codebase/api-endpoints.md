# API Endpoints (Target Systems)

> Generated: 2026-06-12
> Re-run: /scan-codebase --section api
> Note: Đây là các endpoint **bên ngoài** mà k6 scripts tấn công load test.
> Không phải endpoint của repo này (repo không có web server).

---

## Tổng quan

| Scenario | Script | Method | Endpoint | Content-Type |
|----------|--------|--------|----------|--------------|
| Legacy MCR coupon | `k6-api-post-xml.js` | POST | `TARGET_URL` (root) | `application/xml` |
| rkCRM Get coupon info | `k6-rkcrm-cardinfo.js` | POST | `TARGET_URL` (root) | `application/xml` |
| rkCRM Get card info | `k6-rkcrm-cardholder.js` | POST | `TARGET_URL` (root) | `application/xml` |
| NewApp Get card info | `k6-newapp-cardinfo.js` | POST | `{TARGET_URL}/getcardinfoex` | `application/xml` |

---

## Endpoint 1: Legacy MCR Coupon XML

- **URL:** `http://192.168.2.104:8100` (hoặc `TARGET_URL`)
- **Method:** POST
- **Script:** [`k6/k6-api-post-xml.js`](../../k6/k6-api-post-xml.js)
- **Headers:** `Content-Type: application/xml; charset=utf-8`
- **Request body:**
  ```xml
  <?xml version="1.0" encoding="utf-8" standalone="yes" ?>
  <Message>
    <Coupon_ID>{couponCode}</Coupon_ID>
    <Partner_Code>{partnerCode}</Partner_Code>
  </Message>
  ```
- **Thresholds:** `http_req_failed < 5%`, `p(95) < 2000ms`, `p(99) < 5000ms`
- **k6 tag:** `api=coupon_xml_post`

---

## Endpoint 2: rkCRM — Get coupon info

- **URL:** `http://61.28.226.116:9192` (hoặc `TARGET_URL_RKCRM`)
- **Method:** POST
- **Script:** [`k6/k6-rkcrm-cardinfo.js`](../../k6/k6-rkcrm-cardinfo.js)
- **Headers:** `Content-Type: application/xml; charset=utf-8`
- **Request body:**
  ```xml
  <?xml version="1.0" encoding="utf-8" standalone="yes" ?>
  <Message Action="Get coupon info" Terminal_Type="CRM_DCORP">
    <Coupon_ID>{couponCode}</Coupon_ID>
  </Message>
  ```
- **Thresholds:** `http_req_failed < 5%`, `p(95) < 3000ms`, `p(99) < 8000ms`
- **k6 tag:** `api=rkcrm_cardinfo_post`

---

## Endpoint 3: rkCRM — Get card info (cardholder)

- **URL:** `http://61.28.226.116:9192` (hoặc `TARGET_URL_RKCRM`)
- **Method:** POST
- **Script:** [`k6/k6-rkcrm-cardholder.js`](../../k6/k6-rkcrm-cardholder.js)
- **Headers:** `Content-Type: application/xml; charset=utf-8`
- **Request body:**
  ```xml
  <?xml version="1.0" encoding="utf-8" standalone="yes" ?>
  <Message Action="Get card info" Terminal_Type="CRM_DCORP"
           Global_Type="kd3ZhhFF4vBllah1UM3R" Unit_ID="1" User_ID="1">
    <Card_Code>{cardCode}</Card_Code>
    <Include>Account,Holder_Contact,Holder_Coupon</Include>
  </Message>
  ```
- **Thresholds:** `http_req_failed < 5%`, `p(95) < 3000ms`, `p(99) < 8000ms`
- **k6 tag:** `api=rkcrm_cardholder_post`

---

## Endpoint 4: NewApp — getcardinfoex

- **URL:** `http://61.28.226.116:9192/getcardinfoex` (hoặc `{TARGET_URL}/getcardinfoex`)
- **Method:** POST
- **Script:** [`k6/k6-newapp-cardinfo.js`](../../k6/k6-newapp-cardinfo.js)
- **Headers:** `Content-Type: application/xml; charset=utf-8`
- **Request body:**
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <ROOT>
    <QRY Card="{cardCode}" Restaurant="1" UnitNo="65">
    </QRY>
  </ROOT>
  ```
- **Thresholds:** `http_req_failed < 5%`, `p(95) < 3000ms`, `p(99) < 8000ms`
- **k6 tag:** `api=newapp_cardinfo_post`

---

## Load Model (tất cả scenarios)

```
executor: constant-arrival-rate
rate: RPS (default 200)
timeUnit: 1s
duration: DURATION (default 2m)
preAllocatedVUs: PRE_VUS (default 100)
maxVUs: MAX_VUS (default 200)
```

---

## Thêm endpoint mới

1. Tạo `k6/k6-<system>-<action>.js` — copy pattern từ `k6-rkcrm-cardinfo.js`
2. Implement `buildXmlPayload()` cho XML format của system mới
3. Tạo `k6/run-<system>-<action>.sh` — set `TARGET_URL`, data file, `SKIP_COUPON_FETCH=1`
4. Thêm npm script trong `package.json`
5. Thêm entry vào bảng tổng quan ở trên
