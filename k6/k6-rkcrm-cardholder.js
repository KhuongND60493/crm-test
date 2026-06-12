import http from "k6/http";
import { check } from "k6";

const TARGET_URL = __ENV.TARGET_URL || "http://127.0.0.1:8100";
const RPS = Number(__ENV.K6_RPS || __ENV.RPS || 10);
const DURATION = __ENV.K6_DURATION || __ENV.DURATION || "30s";
const PRE_VUS = Number(__ENV.K6_PRE_VUS || __ENV.PRE_VUS || 20);
const MAX_VUS = Number(__ENV.K6_MAX_VUS || __ENV.MAX_VUS || 200);

const TERMINAL_TYPE = __ENV.TERMINAL_TYPE || "CRM_DCORP";
const ACTION = __ENV.RKCRM_CARDHOLDER_ACTION || "Get card info";
const GLOBAL_TYPE = __ENV.RKCRM_GLOBAL_TYPE || "kd3ZhhFF4vBllah1UM3R";
const UNIT_ID = __ENV.RKCRM_UNIT_ID || "1";
const USER_ID = __ENV.RKCRM_USER_ID || "1";
const INCLUDE = __ENV.RKCRM_CARDHOLDER_INCLUDE || "Account,Holder_Contact,Holder_Coupon";
const CARD_CODES_FILE =
  __ENV.RKCRM_CARD_CODES_FILE || __ENV.COUPON_CODES_FILE || "./coupon-codes-2-9.txt";

const cardCodes = open(CARD_CODES_FILE)
  .split(/\r?\n/)
  .map((v) => v.trim())
  .filter((v) => v.length > 0);

if (cardCodes.length === 0) {
  throw new Error(
    `No card codes found in ${CARD_CODES_FILE}. Please provide a non-empty text file.`,
  );
}

function buildXmlPayload(cardCode) {
  return `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<Message Action="${ACTION}" Terminal_Type="${TERMINAL_TYPE}" Global_Type="${GLOBAL_TYPE}" Unit_ID="${UNIT_ID}" User_ID="${USER_ID}">
<Card_Code>${cardCode}</Card_Code>
<Include>${INCLUDE}</Include>
</Message>`;
}

export const options = {
  scenarios: {
    rkcrm_cardholder_load: {
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
  const randomIndex = Math.floor(Math.random() * cardCodes.length);
  const randomCardCode = cardCodes[randomIndex];
  const xmlPayload = buildXmlPayload(randomCardCode);

  const res = http.post(TARGET_URL, xmlPayload, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      Accept: "application/xml, text/xml, */*",
    },
    tags: { api: "rkcrm_cardholder_post", card_code: randomCardCode },
  });
  check(res, {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
  });
}
