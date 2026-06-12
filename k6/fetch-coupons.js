const fs = require("fs");
const path = require("path");
const sql = require("mssql");

const envFilePath = process.env.ENV_FILE || path.join(__dirname, ".env.k6");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(envFilePath);

const connectionString = process.env.MSSQL_CONNECTION_STRING || "";
const query =
  process.env.COUPON_SQL_QUERY ||
  "SELECT COUPON_CODE FROM CARD_COUPONS WHERE COUPON_CODE IS NOT NULL AND LTRIM(RTRIM(COUPON_CODE)) <> '' AND DELETED = 0";
const outputFile =
  process.env.COUPON_CODES_FILE || path.join(__dirname, "coupon-codes.txt");

if (!connectionString) {
  console.error("Error: MSSQL_CONNECTION_STRING is empty.");
  process.exit(1);
}

async function main() {
  let pool;
  try {
    pool = await sql.connect(connectionString);
    const result = await pool.request().query(query);
    const rows = result.recordset || [];

    const couponCodes = rows
      .map((row) => {
        const value = row.COUPON_CODE;
        return value === null || value === undefined ? "" : String(value).trim();
      })
      .filter((value) => value.length > 0);

    if (couponCodes.length === 0) {
      console.error("Error: Query returned 0 coupon codes.");
      process.exit(1);
    }

    fs.writeFileSync(outputFile, `${couponCodes.join("\n")}\n`, "utf8");
    console.log(`Fetched ${couponCodes.length} coupon codes to ${outputFile}`);
  } catch (error) {
    console.error(`Error fetching coupons: ${error.message}`);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

main();
