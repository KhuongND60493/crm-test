# k6 CRM Load Test Toolkit

Bộ công cụ load test hiệu năng cho các API CRM nội bộ, sử dụng [Grafana k6](https://k6.io/).

---

## Dự án này là gì?

Repo **không chứa source code CRM**. Đây là bộ script k6 để kiểm tra tải (load test) các API CRM bên ngoài:

| System | Mô tả |
|--------|-------|
| **rkCRM** | API XML nội bộ — lấy thông tin coupon / cardholder |
| **NewApp** | REST endpoint `/getcardinfoex` |
| **Legacy MCR** | Coupon XML API cũ |

Dữ liệu test (coupon codes, card codes) được lấy từ **Microsoft SQL Server** và lưu vào file `.txt` để k6 random chọn mỗi request.

---

## Yêu cầu cài đặt

| Tool | Version | Cài đặt |
|------|---------|---------|
| [k6](https://k6.io/docs/get-started/installation/) | latest | xem bên dưới |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | bundled với Node | — |

### Cài k6 trên macOS

```bash
brew install k6
```

### Cài k6 trên Windows

**Cách 1 — Winget (Windows 10/11, khuyến nghị):**
```powershell
winget install k6 --source winget
```

**Cách 2 — Chocolatey:**
```powershell
choco install k6
```

**Cách 3 — Tải thủ công:**
1. Vào [github.com/grafana/k6/releases](https://github.com/grafana/k6/releases)
2. Tải file `k6-vX.X.X-windows-amd64.zip`
3. Giải nén → copy `k6.exe` vào thư mục có trong `PATH` (ví dụ `C:\Windows\System32`)

**Kiểm tra sau khi cài:**
```powershell
k6 version
node --version
```

> ⚠️ **Windows lưu ý:** Các file shell script (`.sh`) không chạy được trực tiếp trên CMD/PowerShell.
> Dùng **Git Bash** hoặc **WSL** để chạy `bash k6/run-*.sh`.
> Hoặc dùng lệnh `npm run ...` — các lệnh này chạy được trên mọi terminal.

---

## Cài đặt

```bash
# 1. Clone repo
git clone <repo-url>
cd crm-test

# 2. Cài Node dependencies (mssql driver)
npm install
```

---

## Cấu hình

Sao chép và chỉnh sửa file cấu hình:

```bash
# File cấu hình nằm ở đây (đã có sẵn trong repo)
k6/.env.k6
```

Các biến **bắt buộc phải điền** trước khi chạy:

```bash
# URL các API target
TARGET_URL=http://<ip-legacy>:8100
TARGET_URL_RKCRM=http://<ip-rkcrm>:9192

# SQL Server (để fetch coupon codes — bỏ qua nếu dùng file có sẵn)
MSSQL_CONNECTION_STRING=Server=<host>,1433;Database=DEV_CRM;User Id=<user>;Password=<pass>;Encrypt=True;TrustServerCertificate=True;
```

Các biến load (có thể giữ mặc định):

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `RPS` | `200` | Requests/giây |
| `DURATION` | `2m` | Thời gian chạy |
| `PRE_VUS` | `100` | VU khởi tạo |
| `MAX_VUS` | `200` | VU tối đa |

---

## Chuẩn bị dữ liệu test

File dữ liệu mẫu đã có sẵn trong repo:

| File | Nội dung |
|------|----------|
| `k6/cp1.txt` | ~1M coupon codes |
| `k6/customer-stg.txt` | ~43 card/customer codes (staging) |

Nếu cần **refresh từ SQL Server**:

```bash
npm run fetch-coupons
# → Tạo k6/coupon-codes.txt từ bảng CARD_COUPONS
```

---

## Chạy load test

### rkCRM — Get coupon info

```bash
npm run test-rkcrm-cardinfo
# hoặc
bash k6/run-rkcrm-cardinfo.sh
```

### rkCRM — Get card info (cardholder)

```bash
npm run test-rkcrm-cardholder
# hoặc
bash k6/run-rkcrm-cardholder.sh
```

### NewApp — getcardinfoex

```bash
npm run test-newapp-cardinfo
# hoặc
bash k6/run-newapp-cardinfo.sh
```

### Legacy MCR — Coupon XML

```bash
npm run test-mcr
# hoặc
bash k6/run.sh
```

### Tùy chỉnh nhanh khi chạy

```bash
# Giảm RPS và thời gian để test nhanh
RPS=10 DURATION=30s bash k6/run-rkcrm-cardinfo.sh

# Dùng file coupon khác
COUPON_CODES_FILE=./k6/my-codes.txt bash k6/run-rkcrm-cardinfo.sh
```

---

## Đọc kết quả

Sau khi chạy, k6 in summary trong terminal:

```
✓ status is 2xx

checks.........................: 99.80%
http_req_duration..............: avg=245ms  p(95)=890ms  p(99)=2100ms
http_req_failed................: 0.20%
http_reqs......................: 24000  (200/s)
```

**Thresholds mặc định** (test fail nếu vi phạm):

| Metric | rkCRM / NewApp | Legacy MCR |
|--------|---------------|------------|
| Fail rate | < 5% | < 5% |
| p(95) latency | < 3,000ms | < 2,000ms |
| p(99) latency | < 8,000ms | < 5,000ms |

---

## Observability (tuỳ chọn)

File `k6/dashboard.json` là Grafana dashboard sẵn dùng với Prometheus metrics từ k6.

Xem thêm: [k6 Prometheus integration](https://k6.io/docs/results-output/real-time/prometheus-remote-write/)

---

## Cấu trúc thư mục

```
crm-test/
├── package.json                  # npm scripts
├── k6/
│   ├── .env.k6                   # Cấu hình (TARGET_URL, RPS, ...)
│   ├── src/utils.js              # Helper: parse env, đọc file codes
│   ├── fetch-coupons.js          # Node script: SQL Server → file .txt
│   ├── k6-api-post-xml.js        # Legacy MCR coupon XML
│   ├── k6-rkcrm-cardinfo.js      # rkCRM: Get coupon info
│   ├── k6-rkcrm-cardholder.js    # rkCRM: Get card info
│   ├── k6-newapp-cardinfo.js     # NewApp: /getcardinfoex
│   ├── k6-test.js                # ⚠️ WIP — chưa implement HTTP
│   ├── run.sh                    # Runner chung
│   ├── run-rkcrm-cardinfo.sh     # Runner cho rkCRM coupon info
│   ├── run-rkcrm-cardholder.sh   # Runner cho rkCRM cardholder
│   ├── run-newapp-cardinfo.sh    # Runner cho NewApp
│   ├── cp1.txt                   # ~1M coupon codes
│   ├── customer-stg.txt          # Card codes staging
│   └── dashboard.json            # Grafana dashboard
└── docs/
    ├── project_overview.md       # Kiến trúc và patterns chi tiết
    └── codebase/                 # Reference docs (entity, env, schema, endpoints)
```

---

## Thêm scenario mới

1. Tạo `k6/k6-<system>-<action>.js` — copy pattern từ `k6-rkcrm-cardinfo.js`
2. Tạo `k6/run-<system>-<action>.sh` — set `TARGET_URL`, data file, `SKIP_COUPON_FETCH=1`
3. Thêm npm script trong `package.json`
4. Điền thông tin vào `docs/codebase/api-endpoints.md`

---

## Lưu ý bảo mật

- **Không commit** `MSSQL_CONNECTION_STRING` hay credential thật vào git
- File `.env.k6` đã có trong repo với giá trị dev — thay bằng giá trị thật khi chạy staging/prod
- IP nội bộ trong `.env.k6` chỉ dùng được trong mạng LAN/VPN công ty

---

*Dcorp Vietnam — Load Testing Toolkit*
