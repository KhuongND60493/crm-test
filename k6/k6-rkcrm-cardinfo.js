import http from "k6/http";
import { check } from "k6";

const TARGET_URL = __ENV.TARGET_URL || "http://127.0.0.1:8100";
const RPS = Number(__ENV.K6_RPS || __ENV.RPS || 10);
const DURATION = __ENV.K6_DURATION || __ENV.DURATION || "30s";
const PRE_VUS = Number(__ENV.K6_PRE_VUS || __ENV.PRE_VUS || 20);
const MAX_VUS = Number(__ENV.K6_MAX_VUS || __ENV.MAX_VUS || 200);
const COUPON_CODES_FILE = __ENV.COUPON_CODES_FILE || "./cp1.txt";

const ACTION = __ENV.RKCRM_ACTION || "Get coupon info";
const TERMINAL_TYPE = __ENV.TERMINAL_TYPE || "CRM_DCORP";

const couponCodes = open(COUPON_CODES_FILE)
  .split(/\r?\n/)
  .map((v) => v.trim())
  .filter((v) => v.length > 0);

if (couponCodes.length === 0) {
  throw new Error(
    `No coupon codes found in ${COUPON_CODES_FILE}. Please fetch data from DB before running k6.`,
  );
}

function buildXmlPayload(couponCode) {
  return `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<Message Action="${ACTION}" Terminal_Type="${TERMINAL_TYPE}">
<Coupon_ID>${couponCode}</Coupon_ID>
</Message>`;
}

export const options = {
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

export default function () {
  const randomIndex = Math.floor(Math.random() * couponCodes.length);
  const randomCouponCode = couponCodes[randomIndex];
  const xmlPayload = buildXmlPayload(randomCouponCode);
  console.log(xmlPayload);
  const res = http.post(TARGET_URL, xmlPayload, {
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
