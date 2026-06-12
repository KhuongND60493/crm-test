import http from "k6/http";
import {check} from "k6";
import {getEnv, getCouponCodes} from "./src/utils.js";

let codes = [];
const env = getEnv(__ENV);
console.log('test name:', {name:env.TEST_NAME, customer:env.CUSTOMER_CODES_FILE, codes:env.COUPON_CODES_FILE});
switch (env.TEST_NAME) {
    case 'customer-info':
        console.log('customer-info test, load customer codes from', env.CUSTOMER_CODES_FILE)
        codes = getCouponCodes(env.CUSTOMER_CODES_FILE);
        break;
    default:
        console.log( 'test name not specified or not recognized, load coupon codes from', env.COUPON_CODES_FILE)
        codes = getCouponCodes(env.COUPON_CODES_FILE);
        break;
}

export default function () {
    console.log('romio', codes.length);
}

