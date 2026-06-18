import http from "k6/http";
import { check } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const TARGET_URL = __ENV.TARGET_URL || "http://127.0.0.1:8100";
const COUPON_CODES_FILE = __ENV.COUPON_CODES_FILE || "./cp1.txt";
const TERMINAL_TYPE = __ENV.TERMINAL_TYPE || "CRM_API";
const FLOW_RPS = Number(__ENV.FLOW_RPS || __ENV.RPS || 7);
const DURATION = __ENV.DURATION || "60s";
const PRE_VUS = Number(__ENV.PRE_VUS || 100);
const MAX_VUS = Number(__ENV.MAX_VUS || 500);

const couponCodes = open(COUPON_CODES_FILE)
  .split(/\r?\n/)
  .map((v) => v.trim())
  .filter((v) => v.length > 0);

if (couponCodes.length === 0) {
  throw new Error(
    `No coupon codes found in ${COUPON_CODES_FILE}. Please fetch data from DB before running k6.`,
  );
}

function buildCardInfoPayload(eCode) {
  return `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<Message Action="Get coupon info" Terminal_Type="${TERMINAL_TYPE}">
<Coupon_ID>${eCode}</Coupon_ID>
</Message>`;
}

function buildLogLine(step, eCode, duration, pass, body) {
  const ts      = new Date().toISOString();
  const stepNum = step.replace("step", "");
  const result  = pass ? "P" : "F";
  let content;
  if (body === null || body === undefined || body.trim().length === 0) {
    content = pass ? "(empty)" : "(timeout)";
  } else {
    content = body.trim().replace(/<\?xml[^?]*\?>\s*/i, "");
  }
  return `REQLOG|${ts}|${stepNum}|${eCode}|${duration}|${result}|${content}`;
}

function buildTransactionPayload(eCode) {
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

// Stage boundaries (giây từ lúc bắt đầu)
const STAGES = [
  { tag: "s1", label: "10->50 iter/s",   start:  0, end:  30, target:  50 },
  { tag: "s2", label: "50->100 iter/s",  start: 30, end:  60, target: 100 },
  { tag: "s3", label: "100->150 iter/s", start: 60, end:  90, target: 150 },
  { tag: "s4", label: "150->200 iter/s", start: 90, end: 120, target: 200 },
  { tag: "s5", label: "200 iter/s hold", start:120, end: 180, target: 200 },
];

// Per-stage metrics (không dùng — giữ lại để không break stageMetrics reference bên dưới)
const stageMetrics = {};
for (const s of STAGES) {
  stageMetrics[s.tag] = {
    latency: new Trend(`latency_${s.tag}`, true),
    failed:  new Rate(`failed_${s.tag}`),
    reqs:    new Counter(`reqs_${s.tag}`),
  };
}

// Per-step metrics
const step1Latency = new Trend("step1_latency", true);
const step2Latency = new Trend("step2_latency", true);
const step3Latency = new Trend("step3_latency", true);
const step1Reqs    = new Counter("step1_reqs");
const step2Reqs    = new Counter("step2_reqs");
const step3Reqs    = new Counter("step3_reqs");
const step1Failed  = new Counter("step1_failed");
const step2Failed  = new Counter("step2_failed");
const step3Failed  = new Counter("step3_failed");

// Flow-level metrics
const flowCompleted = new Counter("flow_completed");
const flowFailed    = new Counter("flow_failed");
const flowDuration  = new Trend("flow_duration", true);

export const options = {
  scenarios: {
    flow_stress: {
      executor: "constant-vus",
      vus: PRE_VUS,
      duration: DURATION,
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
  const m = stageMetrics[stage.tag];

  const eCode = couponCodes[Math.floor(Math.random() * couponCodes.length)];
  const headers = {
    "Content-Type": "application/xml; charset=utf-8",
    Accept: "application/xml, text/xml, */*",
  };

  // Bước 1: getCardInfo lần 1
  const res1 = http.post(TARGET_URL, buildCardInfoPayload(eCode), {
    headers,
    tags: { step: "step1" },
  });
  m.reqs.add(1);
  m.latency.add(res1.timings.duration);
  step1Reqs.add(1);
  step1Latency.add(res1.timings.duration);
  const ok1 = check(res1, { "step1 2xx": (r) => r.status >= 200 && r.status < 300 });
  console.log(buildLogLine("step1", eCode, res1.timings.duration, ok1, res1.body));
  if (!ok1) {
    m.failed.add(1);
    step1Failed.add(1);
    flowFailed.add(1);
    return;
  }
  m.failed.add(0);

  // Bước 2: getCardInfo lần 2
  const res2 = http.post(TARGET_URL, buildCardInfoPayload(eCode), {
    headers,
    tags: { step: "step2" },
  });
  m.reqs.add(1);
  m.latency.add(res2.timings.duration);
  step2Reqs.add(1);
  step2Latency.add(res2.timings.duration);
  const ok2 = check(res2, { "step2 2xx": (r) => r.status >= 200 && r.status < 300 });
  console.log(buildLogLine("step2", eCode, res2.timings.duration, ok2, res2.body));
  if (!ok2) {
    m.failed.add(1);
    step2Failed.add(1);
    flowFailed.add(1);
    return;
  }
  m.failed.add(0);

  // Bước 3: TransactionEx
  const res3 = http.post(TARGET_URL, buildTransactionPayload(eCode), {
    headers,
    tags: { step: "step3" },
  });
  m.reqs.add(1);
  m.latency.add(res3.timings.duration);
  step3Reqs.add(1);
  step3Latency.add(res3.timings.duration);
  const ok3 = check(res3, { "step3 2xx": (r) => r.status >= 200 && r.status < 300 });
  console.log(buildLogLine("step3", eCode, res3.timings.duration, ok3, res3.body));
  if (!ok3) {
    m.failed.add(1);
    step3Failed.add(1);
    flowFailed.add(1);
    return;
  }
  m.failed.add(0);

  // Flow hoàn chỉnh
  flowCompleted.add(1);
  flowDuration.add(res1.timings.duration + res2.timings.duration + res3.timings.duration);
}

export function handleSummary(data) {
  const m = data.metrics;

  const totalCompleted = m["flow_completed"]?.values?.count ?? 0;
  const totalFailed    = m["flow_failed"]?.values?.count    ?? 0;
  const totalFlows     = totalCompleted + totalFailed;
  const dropped        = m["dropped_iterations"]?.values?.count ?? 0;
  const actualRps      = m["flow_completed"]?.values?.rate  ?? 0;
  const actualReqRate  = m["http_reqs"]?.values?.rate ?? 0;
  const flowFailPct    = totalFlows > 0 ? ((totalFailed / totalFlows) * 100).toFixed(2) : "0.00";
  const avgDuration    = m["flow_duration"]?.values?.avg    ?? 0;
  const p95Duration    = m["flow_duration"]?.values?.["p(95)"] ?? 0;
  const flowStatus     = (totalFailed / Math.max(totalFlows, 1)) > 0.05 ? "❌ FAIL"
                       : totalFailed > 0 ? "⚠️  WARN" : "✅ OK";

  // Per-step
  const s1Reqs   = m["step1_reqs"]?.values?.count ?? 0;
  const s2Reqs   = m["step2_reqs"]?.values?.count ?? 0;
  const s3Reqs   = m["step3_reqs"]?.values?.count ?? 0;
  const s1Fail   = m["step1_failed"]?.values?.count ?? 0;
  const s2Fail   = m["step2_failed"]?.values?.count ?? 0;
  const s3Fail   = m["step3_failed"]?.values?.count ?? 0;
  const s1Avg    = m["step1_latency"]?.values?.avg ?? 0;
  const s2Avg    = m["step2_latency"]?.values?.avg ?? 0;
  const s3Avg    = m["step3_latency"]?.values?.avg ?? 0;
  const s1P95    = m["step1_latency"]?.values?.["p(95)"] ?? 0;
  const s2P95    = m["step2_latency"]?.values?.["p(95)"] ?? 0;
  const s3P95    = m["step3_latency"]?.values?.["p(95)"] ?? 0;
  const totalReqs = s1Reqs + s2Reqs + s3Reqs;
  const expectedReqs = totalFlows * 3;

  function pct(fail, total) {
    return total > 0 ? ((fail / total) * 100).toFixed(2) + "%" : "0.00%";
  }

  const lines = [
    "",
    "═══════════════════════════════════════════════════════════════════",
    "  FLOW LOAD TEST — DETAILED SUMMARY",
    `  Target : ${TARGET_URL}`,
    `  Flow   : getCardInfo(1) → getCardInfo(2) → TransactionEx`,
    "═══════════════════════════════════════════════════════════════════",
    "",
    "  ── FLOW OVERVIEW ──────────────────────────────────────────────",
    `  Target flows/s   : ${FLOW_RPS}`,
    `  Actual flows/s   : ${actualRps.toFixed(1)}`,
    `  Server req/s     : ${actualReqRate.toFixed(1)} req/s (tổng request thực tế vào server)`,
    `  Duration         : ${DURATION}`,
    `  Expected flows   : ${FLOW_RPS} × ${DURATION} = ~${Math.round(FLOW_RPS * parseFloat(DURATION))} flows`,
    `  Completed flows  : ${totalCompleted}   ✅`,
    `  Failed flows     : ${totalFailed}   ${flowStatus}`,
    `  Dropped (no VU)  : ${dropped}`,
    `  Flow fail rate   : ${flowFailPct}%`,
    `  Avg chain time   : ${Math.round(avgDuration)} ms`,
    `  p95 chain time   : ${Math.round(p95Duration)} ms`,
    "",
    "  ── REQUEST BREAKDOWN ──────────────────────────────────────────",
    `  Expected requests: ${totalFlows} flows × 3 steps = ${expectedReqs}`,
    `  Actual sent      : ${totalReqs} requests`,
    `  (diff = flows stopped early due to step failure)`,
    "",
    `  ${"Step".padEnd(22)} ${"Sent".padEnd(8)} ${"Failed".padEnd(8)} ${"Fail%".padEnd(8)} ${"Avg(ms)".padEnd(10)} ${"p95(ms)"}`,
    "  " + "─".repeat(68),
    `  ${"Step1: getCardInfo(1)".padEnd(22)} ${String(s1Reqs).padEnd(8)} ${String(s1Fail).padEnd(8)} ${pct(s1Fail, s1Reqs).padEnd(8)} ${String(Math.round(s1Avg)).padEnd(10)} ${Math.round(s1P95)}`,
    `  ${"Step2: getCardInfo(2)".padEnd(22)} ${String(s2Reqs).padEnd(8)} ${String(s2Fail).padEnd(8)} ${pct(s2Fail, s2Reqs).padEnd(8)} ${String(Math.round(s2Avg)).padEnd(10)} ${Math.round(s2P95)}`,
    `  ${"Step3: TransactionEx".padEnd(22)}  ${String(s3Reqs).padEnd(8)} ${String(s3Fail).padEnd(8)} ${pct(s3Fail, s3Reqs).padEnd(8)} ${String(Math.round(s3Avg)).padEnd(10)} ${Math.round(s3P95)}`,
    "  " + "─".repeat(68),
    `  ${"TOTAL".padEnd(22)} ${String(totalReqs).padEnd(8)} ${String(s1Fail+s2Fail+s3Fail).padEnd(8)} ${pct(s1Fail+s2Fail+s3Fail, totalReqs).padEnd(8)}`,
    "",
    "═══════════════════════════════════════════════════════════════════",
    "",
  ];

  return { stdout: lines.join("\n") };
}
