export function getEnv(env) {
    const TEST_NAME = env.TESTNAME || "";
    const SV = env.SV || "";
    const TARGET_URL = env.TARGET_URL || "";
    const RPS = Number(env.RPS || 10);
    const DURATION = env.DURATION || "30s";
    const PRE_VUS = Number(env.PRE_VUS || 20);
    const MAX_VUS = Number(env.MAX_VUS || 200);
    const PARTNER_CODE = env.PARTNER_CODE || "1";
    const COUPON_CODES_FILE = env.COUPON_TXT || "";
    const CUSTOMER_CODES_FILE = env.CUSTOMER_TXT || "";
    return {
        TEST_NAME,
        SV,
        TARGET_URL,
        RPS,
        DURATION,
        PRE_VUS,
        MAX_VUS,
        PARTNER_CODE,
        COUPON_CODES_FILE,
        CUSTOMER_CODES_FILE
    };
}


export function getCouponCodes(filePath) {
    const couponCodes = open(filePath)
        .split(/\r?\n/)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);

    if (couponCodes.length === 0) {
        throw new Error(
            `No coupon codes found in ${filePath}. Please provide a non-empty txt file.`,
        );
    }
    return couponCodes;
}
