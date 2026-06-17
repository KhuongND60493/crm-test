import http from "k6/http";
import { check } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const TARGET_URL = __ENV.TARGET_URL || "http://127.0.0.1:8100";
const COUPON_CODES_FILE = __ENV.COUPON_CODES_FILE || "./cp1.txt";
const ACTION = __ENV.RKCRM_ACTION || "Get coupon info";
const TERMINAL_TYPE = __ENV.TERMINAL_TYPE || "CRM_API";

const couponCodes = open(COUPON_CODES_FILE)
  .split(/\r?\n/)
  .map((v) => v.trim())
  .filter((v) => v.length > 0);

function buildXmlPayload(couponCode) {
  return `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<Message Action="${ACTION}" Terminal_Type="${TERMINAL_TYPE}">
<Coupon_ID>${couponCode}</Coupon_ID>
</Message>`;
}

// Stage boundaries (giây từ lúc bắt đầu)
const STAGES = [
  { tag: "s1", label: "10->50 req/s",   start:  0, end:  30, target:  50 },
  { tag: "s2", label: "50->100 req/s",  start: 30, end:  60, target: 100 },
  { tag: "s3", label: "100->150 req/s", start: 60, end:  90, target: 150 },
  { tag: "s4", label: "150->200 req/s", start: 90, end: 120, target: 200 },
  { tag: "s5", label: "200 req/s hold", start:120, end: 180, target: 200 },
];

// Metric riêng cho từng stage (không dùng tag — k6 không expose sub-metrics trong handleSummary)
const stageMetrics = {};
for (const s of STAGES) {
  stageMetrics[s.tag] = {
    latency: new Trend(`latency_${s.tag}`, true),
    failed:  new Rate(`failed_${s.tag}`),
    reqs:    new Counter(`reqs_${s.tag}`),
  };
}

export const options = {
  scenarios: {
    stress: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 400,
      maxVUs: 1000,
      stages: [
        { target:  50, duration: "30s" },
        { target: 100, duration: "30s" },
        { target: 150, duration: "30s" },
        { target: 200, duration: "30s" },
        { target: 200, duration: "60s" },
        { target:   0, duration: "10s" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.10"],
  },
};

export function setup() {
  return { startTime: Date.now() };
}

export default function (data) {
  const elapsed = (Date.now() - data.startTime) / 1000;
  const stage = STAGES.find((s) => elapsed >= s.start && elapsed < s.end) || STAGES[STAGES.length - 1];

  const randomIndex = Math.floor(Math.random() * couponCodes.length);
  const couponCode = couponCodes[randomIndex];
  const res = http.post(TARGET_URL, buildXmlPayload(couponCode), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      Accept: "application/xml, text/xml, */*",
    },
    tags: { stage: stage.tag },
  });

  const ok = check(res, { "status is 2xx": (r) => r.status >= 200 && r.status < 300 });
  stageMetrics[stage.tag].latency.add(res.timings.duration);
  stageMetrics[stage.tag].failed.add(!ok);
  stageMetrics[stage.tag].reqs.add(1);
}

export function handleSummary(data) {
  const lines = [
    "",
    "═══════════════════════════════════════════════════════════════════════",
    "  STRESS TEST — BREAKING POINT REPORT",
    `  Target: ${TARGET_URL}`,
    "═══════════════════════════════════════════════════════════════════════",
    `  ${"Stage".padEnd(20)} ${"Target".padEnd(10)} ${"Actual".padEnd(10)} ${"Reqs".padEnd(7)} ${"Avg(ms)".padEnd(9)} ${"p95(ms)".padEnd(9)} ${"Fail%".padEnd(8)} Status`,
    "  " + "─".repeat(79),
  ];

  for (const stage of STAGES) {
    const duration = stage.end - stage.start;
    const reqs     = data.metrics[`reqs_${stage.tag}`]    ?.values?.count ?? 0;
    const avg      = data.metrics[`latency_${stage.tag}`] ?.values?.avg   ?? 0;
    const p95      = data.metrics[`latency_${stage.tag}`] ?.values?.["p(95)"] ?? 0;
    const failRate = data.metrics[`failed_${stage.tag}`]  ?.values?.rate  ?? 0;
    const actualRps = reqs > 0 ? (reqs / duration).toFixed(1) : "0.0";
    const failPct  = (failRate * 100).toFixed(2);
    const status   = failRate > 0.05 ? "❌ FAIL" : failRate > 0 ? "⚠️  WARN" : "✅ OK";

    lines.push(
      `  ${stage.label.padEnd(20)} ${(stage.target + " r/s").padEnd(10)} ${(actualRps + " r/s").padEnd(10)} ${String(reqs).padEnd(7)} ${String(Math.round(avg)).padEnd(9)} ${String(Math.round(p95)).padEnd(9)} ${(failPct + "%").padEnd(8)} ${status}`
    );
  }

  lines.push("═══════════════════════════════════════════════════════════════════════");
  lines.push("");

  return {
    stdout: lines.join("\n"),
  };
}
