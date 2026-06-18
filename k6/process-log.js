// Usage: node k6/process-log.js <raw-log-file> <output-log-file>
const fs   = require("fs");
const path = require("path");

const [,, rawFile, outFile] = process.argv;
if (!rawFile || !outFile) {
  console.error("Usage: node k6/process-log.js <raw-log> <output-log>");
  process.exit(1);
}

if (!fs.existsSync(rawFile)) {
  console.error(`[process-log] Raw log not found: ${rawFile}`);
  process.exit(1);
}

const raw   = fs.readFileSync(rawFile, "utf8");
const lines = raw.split(/\r?\n/);

// k6 --log-output=file line format:
// time="2026-06-18T07:30:22+07:00" level=info msg="REQLOG|..."
// Extract msg value, filter only REQLOG lines
const logLines = lines
  .map((line) => {
    const match = line.match(/msg="(REQLOG\|(?:[^"\\]|\\.)*)"/)
    if (!match) return null;
    // Unescape \" back to " (k6 escapes quotes in log output)
    const raw   = match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    // Strip leading "REQLOG|" and join remaining fields with " | "
    const parts = raw.split("|");
    return parts.slice(1).join(" | ");
  })
  .filter(Boolean);

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, logLines.join("\n") + "\n", "utf8");
console.log(`[process-log] Written ${logLines.length} lines → ${outFile}`);
