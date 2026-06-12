import http from "k6/http";
import { check } from "k6";

const TARGET_URL = (__ENV.TARGET_URL || "http://127.0.0.1:8100").replace(/\/+$/, "");
const ENDPOINT_URL = `${TARGET_URL}/getcardinfoex`;

const RPS = Number(__ENV.K6_RPS || __ENV.RPS || 10);
const DURATION = __ENV.K6_DURATION || __ENV.DURATION || "30s";
const PRE_VUS = Number(__ENV.K6_PRE_VUS || __ENV.PRE_VUS || 20);
const MAX_VUS = Number(__ENV.K6_MAX_VUS || __ENV.MAX_VUS || 200);

const CARDS_FILE =
  __ENV.NEWAPP_CARDS_FILE || __ENV.COUPON_CODES_FILE || "./coupon-codes-2-9.txt";
const RESTAURANT = __ENV.NEWAPP_RESTAURANT || "1";
const UNIT_NO = __ENV.NEWAPP_UNIT_NO || "65";

const cards = open(CARDS_FILE)
  .split(/\r?\n/)
  .map((v) => v.trim())
  .filter((v) => v.length > 0);

if (cards.length === 0) {
  throw new Error(
    `No cards found in ${CARDS_FILE}. Please provide a non-empty text file.`,
  );
}

function buildXmlPayload(card) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ROOT>
    <QRY Card="${card}" Restaurant="${RESTAURANT}" UnitNo="${UNIT_NO}">
    </QRY>
</ROOT>`;
}

export const options = {
  scenarios: {
    newapp_cardinfo_load: {
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
  const randomIndex = Math.floor(Math.random() * cards.length);
  const randomCard = cards[randomIndex];
console.log(randomCard);

 const xmlPayload =buildXmlPayload(randomCard);
  const res = http.post(ENDPOINT_URL, xmlPayload, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      Accept: "application/xml, text/xml, */*",
    },
    tags: { api: "newapp_cardinfo_post", card: randomCard },
  });

  check(res, {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
  });
}
