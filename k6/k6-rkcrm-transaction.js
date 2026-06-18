import http from "k6/http";
import { check } from "k6";
import { scenario } from "k6/execution";

const TARGET_URL = __ENV.TARGET_URL || "http://127.0.0.1:8100";
const TARGET_URL_SV2 = __ENV.TARGET_URL_SV2 || "";
const RPS = Number(__ENV.K6_RPS || __ENV.RPS || 10);
const DURATION = __ENV.K6_DURATION || __ENV.DURATION || "30s";
const PRE_VUS = Number(__ENV.K6_PRE_VUS || __ENV.PRE_VUS || 20);
const MAX_VUS = Number(__ENV.K6_MAX_VUS || __ENV.MAX_VUS || 200);
const COUPON_CODES_FILE = __ENV.COUPON_CODES_FILE || "./cp1.txt";
const TERMINAL_TYPE = __ENV.TERMINAL_TYPE || "CRM_API";

const RATIO_1 = Number(__ENV.K6_RATIO_1 || 0);
const RATIO_2 = Number(__ENV.K6_RATIO_2 || 0);
const DUAL_MODE = (RATIO_1 + RATIO_2 === 100) && TARGET_URL_SV2 !== "";

const RPS_1 = DUAL_MODE ? Math.floor(RPS * RATIO_1 / 100) : RPS;
const RPS_2 = DUAL_MODE ? Math.floor(RPS * RATIO_2 / 100) : 0;

const couponCodes = open(COUPON_CODES_FILE)
  .split(/\r?\n/)
  .map((v) => v.trim())
  .filter((v) => v.length > 0);

if (couponCodes.length === 0) {
  throw new Error(
    `No coupon codes found in ${COUPON_CODES_FILE}. Please fetch data from DB before running k6.`,
  );
}

function buildXmlPayload(eCode) {
  const accountNumber = `0.0.${eCode.slice(6)}.922001`;
  return `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<Message Action="Transaction" Terminal_Type="${TERMINAL_TYPE}" Global_Type="ABC" Unit_ID="1" User_ID="1">
<Transaction>
    <Account_Number>${accountNumber}</Account_Number>
    <External_ID>1003249</External_ID>
    <Amount>60000.00</Amount>
    <External_Index>461930</External_Index>
    <External_Date>2026-06-17</External_Date>
    <Transaction_Time>2026-06-17T13:35:13 +07:00</Transaction_Time>
</Transaction>
</Message>`;
}

function buildDualScenarios() {
  const scenarios = {};
  const thresholds = {};
  if (RPS_1 > 0) {
    scenarios.rkcrm_transaction_sv1 = {
      executor: "constant-arrival-rate",
      rate: RPS_1,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: Math.max(1, Math.ceil(PRE_VUS * RATIO_1 / 100)),
      maxVUs: Math.max(1, Math.ceil(MAX_VUS * RATIO_1 / 100)),
      tags: { server: "sv1" },
    };
    thresholds["http_req_failed{server:sv1}"] = ["rate<0.05"];
    thresholds["http_req_duration{server:sv1}"] = ["p(95)<3000", "p(99)<8000"];
  }
  if (RPS_2 > 0) {
    scenarios.rkcrm_transaction_sv2 = {
      executor: "constant-arrival-rate",
      rate: RPS_2,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: Math.max(1, Math.ceil(PRE_VUS * RATIO_2 / 100)),
      maxVUs: Math.max(1, Math.ceil(MAX_VUS * RATIO_2 / 100)),
      tags: { server: "sv2" },
    };
    thresholds["http_req_failed{server:sv2}"] = ["rate<0.05"];
    thresholds["http_req_duration{server:sv2}"] = ["p(95)<3000", "p(99)<8000"];
  }
  return { scenarios, thresholds };
}

const dualConfig = DUAL_MODE ? buildDualScenarios() : null;

export const options = DUAL_MODE
  ? { scenarios: dualConfig.scenarios, thresholds: dualConfig.thresholds }
  : {
      scenarios: {
        rkcrm_transaction_load: {
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
      },
    };

export default function () {
  const url = DUAL_MODE
    ? (scenario.name === "rkcrm_transaction_sv2" ? TARGET_URL_SV2 : TARGET_URL)
    : TARGET_URL;

  const randomIndex = Math.floor(Math.random() * couponCodes.length);
  const eCode = couponCodes[randomIndex];
  const xmlPayload = buildXmlPayload(eCode);

  const res = http.post(url, xmlPayload, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      Accept: "application/xml, text/xml, */*",
    },
    tags: { api: "rkcrm_transaction_post" },
  });
  check(res, {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
  });
}
