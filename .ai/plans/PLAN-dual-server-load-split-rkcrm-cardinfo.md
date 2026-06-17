# PLAN-dual-server-load-split-rkcrm-cardinfo

> SPEC: `.ai/specs/SPEC-dual-server-load-split-rkcrm-cardinfo.md`
> Date: 2026-06-17

---

## 1. Files thay đổi

| File | Action | Ghi chú |
|------|--------|---------|
| `k6/run-rkcrm-cardinfo.sh` | Modify | Đọc `$1 $2`, validate, tính RPS per server, export env |
| `k6/k6-rkcrm-cardinfo.js` | Modify | Thêm dual-scenario conditional khi có `K6_RATIO_1`/`K6_RATIO_2` |
| `k6/.env.k6` | Modify | Thêm dòng `TARGET_URL_RKCRM_2=...` nếu chưa có |

---

## 2. Steps (theo thứ tự dependency)

**[SH-01]** Sửa `k6/run-rkcrm-cardinfo.sh` — đọc & validate tham số tỉ lệ

File: `k6/run-rkcrm-cardinfo.sh`

Thêm logic **sau** khi resolve `RKCRM_URL` (trước block `unset`):

```bash
RATIO_1="${1:-}"
RATIO_2="${2:-}"

DUAL_MODE=0

if [[ -n "${RATIO_1}" || -n "${RATIO_2}" ]]; then
  # Cả hai phải được truyền
  if [[ -z "${RATIO_1}" || -z "${RATIO_2}" ]]; then
    echo "Error: Phải truyền đủ 2 tham số. Ví dụ: yarn test-rkcrm-cardinfo 50 50"
    exit 1
  fi

  # Phải là số nguyên dương
  if ! [[ "${RATIO_1}" =~ ^[1-9][0-9]*$ ]] || ! [[ "${RATIO_2}" =~ ^[1-9][0-9]*$ ]]; then
    echo "Error: Tỉ lệ phải là số nguyên dương (> 0). Ví dụ: 50 50, 70 30"
    exit 1
  fi

  # Tổng phải = 100
  if [[ $(( RATIO_1 + RATIO_2 )) -ne 100 ]]; then
    echo "Error: RATIO_1 + RATIO_2 phải = 100 (hiện tại: ${RATIO_1} + ${RATIO_2} = $(( RATIO_1 + RATIO_2 )))"
    exit 1
  fi

  # TARGET_URL_RKCRM_2 phải được set
  RKCRM_URL_2="$(awk -F'=' '/^[[:space:]]*TARGET_URL_RKCRM_2[[:space:]]*=/{print substr($0, index($0, "=")+1); exit}' "${SCRIPT_DIR}/.env.k6" 2>/dev/null | sed 's/^[ \t]*//;s/[ \t]*$//')"
  if [[ -z "${RKCRM_URL_2}" ]]; then
    echo "Error: TARGET_URL_RKCRM_2 chưa được cấu hình trong .env.k6"
    exit 1
  fi

  DUAL_MODE=1
fi
```

Sửa block cuối (thay vì pass `TARGET_URL` một mình), export thêm env cho k6:

```bash
ENV_FILE="${SCRIPT_DIR}/.env.k6" \
COUPON_CODES_FILE="${SCRIPT_DIR}/cp1.txt" \
TARGET_URL="${RKCRM_URL}" \
TARGET_URL_SV2="${RKCRM_URL_2:-}" \
K6_RATIO_1="${RATIO_1:-}" \
K6_RATIO_2="${RATIO_2:-}" \
SKIP_COUPON_FETCH=1 \
bash "${SCRIPT_DIR}/run.sh" "${SCRIPT_DIR}/k6-rkcrm-cardinfo.js"
```

> **Lưu ý:** `unset RPS DURATION PRE_VUS MAX_VUS` giữ nguyên — `run.sh` sẽ load từ `.env.k6`. RPS per server được tính trong k6 script (không cần tính ở shell).

---

**[K6-01]** Sửa `k6/k6-rkcrm-cardinfo.js` — thêm dual-scenario conditional

File: `k6/k6-rkcrm-cardinfo.js`

Thêm đọc env mới ở đầu file (sau các `const` hiện có):

```javascript
const RATIO_1 = Number(__ENV.K6_RATIO_1 || 0);
const RATIO_2 = Number(__ENV.K6_RATIO_2 || 0);
const TARGET_URL_SV2 = __ENV.TARGET_URL_SV2 || "";
const DUAL_MODE = RATIO_1 > 0 && RATIO_2 > 0 && TARGET_URL_SV2 !== "";

const RPS_1 = DUAL_MODE ? Math.floor(RPS * RATIO_1 / 100) : RPS;
const RPS_2 = DUAL_MODE ? Math.floor(RPS * RATIO_2 / 100) : 0;
```

Thay toàn bộ block `export const options` bằng conditional:

```javascript
export const options = DUAL_MODE
  ? {
      scenarios: {
        rkcrm_cardinfo_sv1: {
          executor: "constant-arrival-rate",
          rate: RPS_1,
          timeUnit: "1s",
          duration: DURATION,
          preAllocatedVUs: Math.ceil(PRE_VUS * RATIO_1 / 100),
          maxVUs: Math.ceil(MAX_VUS * RATIO_1 / 100),
          tags: { server: "sv1" },
        },
        rkcrm_cardinfo_sv2: {
          executor: "constant-arrival-rate",
          rate: RPS_2,
          timeUnit: "1s",
          duration: DURATION,
          preAllocatedVUs: Math.ceil(PRE_VUS * RATIO_2 / 100),
          maxVUs: Math.ceil(MAX_VUS * RATIO_2 / 100),
          tags: { server: "sv2" },
        },
      },
      thresholds: {
        "http_req_failed{server:sv1}": ["rate<0.05"],
        "http_req_failed{server:sv2}": ["rate<0.05"],
        "http_req_duration{server:sv1}": ["p(95)<3000", "p(99)<8000"],
        "http_req_duration{server:sv2}": ["p(95)<3000", "p(99)<8000"],
      },
    }
  : {
      scenarios: {
        rkcrm_cardinfo_load: {
          executor: "constant-arrival-rate",
          rate: RPS,
          timeUnit: "1s",
          duration: DURATION,
          preAllocatedVUs: PRE_VUS,
          maxVUs: MAX_VUS,
        },
      },
      thresholds: {
        http_req_failed: ["rate<0.05"],
        http_req_duration: ["p(95)<3000", "p(99)<8000"],
      },
    };
```

Sửa `export default function ()` — chọn URL theo scenario đang chạy:

```javascript
export default function () {
  const url = DUAL_MODE
    ? (__ENV.SCENARIO_NAME === "rkcrm_cardinfo_sv2" ? TARGET_URL_SV2 : TARGET_URL)
    : TARGET_URL;

  const randomIndex = Math.floor(Math.random() * couponCodes.length);
  const randomCouponCode = couponCodes[randomIndex];
  const xmlPayload = buildXmlPayload(randomCouponCode);
  const res = http.post(url, xmlPayload, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      Accept: "application/xml, text/xml, */*",
    },
    tags: { api: "rkcrm_cardinfo_post", coupon_code: randomCouponCode },
  });
  check(res, {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
  });
}
```

> **Lưu ý về `__ENV.SCENARIO_NAME`:** k6 inject biến `SCENARIO_NAME` vào mỗi VU tự động kể từ k6 v0.33. Cursor cần xác nhận phiên bản k6 trước khi implement. Nếu cũ hơn, dùng `exec.scenario.name` từ `import { scenario } from 'k6/execution'`.

---

**[ENV-01]** Kiểm tra `k6/.env.k6` — thêm `TARGET_URL_RKCRM_2` nếu chưa có

File: `k6/.env.k6`

Thêm dòng (dưới `TARGET_URL_RKCRM`):
```
TARGET_URL_RKCRM_2=http://<IP_SERVER_2>:<PORT>
```

Điền IP/port thực tế của server 2. Không để trống.

---

## 3. DI Registration

Không áp dụng — project là k6 shell scripts, không có DI container.

---

## 4. DB/API/Config changes

**Config:** Thêm `TARGET_URL_RKCRM_2` vào `k6/.env.k6` — xem bước ENV-01.

**Không có:** DB migration, API endpoint mới, Node dependencies mới.

---

## 5. Cursor Notes

> Paste section này vào đầu chat Cursor trước khi `/implement`.

- **Pattern:** follow `k6-rkcrm-cardinfo.js` (existing single-scenario) — chỉ mở rộng, không rewrite
- **Shell pattern:** follow `run-rkcrm-cardinfo.sh` + `run.sh` — giữ nguyên `env_get()` và `unset` flow
- **Backward-compat bắt buộc:** nếu không truyền `$1 $2` → hành vi y hệt hiện tại, không thay đổi gì
- **KHÔNG sửa:** `run.sh`, `run-rkcrm-cardholder.sh`, `run-newapp-cardinfo.sh`, `k6-rkcrm-cardholder.js`, `k6-newapp-cardinfo.js`
- **k6 version check:** dùng `k6 version` để xác nhận. Nếu ≥ v0.33 → dùng `__ENV.SCENARIO_NAME`. Nếu cũ hơn → `import { scenario } from 'k6/execution'; scenario.name`
- **VU allocation:** mỗi scenario được cấp VU độc lập theo tỉ lệ (`PRE_VUS * RATIO / 100`), dùng `Math.ceil` để không ra 0
- **Tỉ lệ tính RPS:** dùng `Math.floor` (có thể thiếu 1 req/s nếu lẻ — chấp nhận được)
- **Tag server:** scenarios dùng `tags: { server: "sv1" }` ở scenario-level để tất cả metrics trong scenario đó được tag tự động
