# MediCloud — Nền tảng Y tế Số Đa Cơ sở

MediCloud là hệ thống quản lý khám chữa bệnh và cổng thông tin y tế số theo kiến trúc **Modular Monolith + BFF**, phân tách rõ hai cổng giao diện theo vai trò (**Cổng Bệnh nhân** và **Cổng Nhân viên y tế**), sử dụng **PostgreSQL** (kèm Row-Level Security), **Prisma**, **Next.js 15**, **Outbox Event Relay**, **Redis** và **Caddy HTTPS**.

---

## 1. Các chức năng chính

### Xác thực & Bảo mật tài khoản
- Đăng ký & đăng nhập bằng **Email + Mật khẩu** lưu trên PostgreSQL (`scrypt` + salt ngẫu nhiên).
- Xác minh email, **Quên mật khẩu / Đặt lại mật khẩu** qua mã token có thời hạn, và **Đổi mật khẩu**.
- Quản lý phiên đăng nhập phía server (`user_sessions`): tự động thu hồi phiên khi đăng xuất hoặc đổi/đặt lại mật khẩu.
- Hỗ trợ xác thực `OIDC client_credentials` giữa BFF và Clinical API khi bật chế độ `MEDICLOUD_ENV=production`.

### Cổng Bệnh nhân (`http://localhost:3000`)
- **Tổng quan**: Thống kê lịch hẹn sắp tới, ca khám hoàn tất, chỉ số sinh hiệu, khung giờ đang mở và đội ngũ bác sĩ theo cơ sở y tế.
- **Đặt lịch khám 3 bước**: Chọn bác sĩ/chuyên khoa → chọn ngày & khung giờ còn trống → nhập hình thức khám, lý do và ghi chú. Hỗ trợ đổi lịch, hủy lịch và check-in trực tuyến.
- **Hồ sơ & Kết quả**: Tra cứu lịch sử ca khám đã hoàn tất và nhận xét của bác sĩ.
- **Chỉ số sinh hiệu**: Theo dõi lịch sử đo và biểu đồ diễn biến huyết áp, nhịp tim, thân nhiệt.
- **Hồ sơ & Bảo mật**: Tự cập nhật họ tên, nhóm máu, tiền sử dị ứng, ghi chú điều trị (`PatientProfile`), ủy quyền/thu hồi quyền cho người thân (`GuardianDelegation`), xác minh email và đổi mật khẩu.
- **Nhật ký hoạt động**: Theo dõi lịch sử thao tác tài khoản.

### Cổng Nhân viên y tế (`http://localhost:3001`)
- **Hàng đợi phòng khám**: Tiếp nhận, gọi bệnh nhân (`CALLED`), bắt đầu ca khám (`IN_PROGRESS`), ghi nhận nhiều chỉ số sinh hiệu liên tiếp, đính chính chỉ số có lưu vết phiên bản (`AMENDED`), và xác nhận hoàn tất ca khám (`COMPLETED`).
- **Lịch hẹn cơ sở & Hồ sơ**: Quản lý lịch hẹn toàn cơ sở, xử lý vắng mặt (`NO_SHOW`), kiểm tra hồ sơ bệnh án và nhật ký kiểm toán (`AuditEvent`).
- **Quản trị cơ sở**: Tạo khoa/phòng khám mới, cấp tài khoản nhân viên y tế (`PHYSICIAN`, `RECEPTIONIST`, `NURSE`, `AUDITOR`) và công bố khung giờ khám cho bác sĩ.

### Kiến trúc & An toàn dữ liệu
- **Contract & Validation**: OpenAPI `1.1.0` (`packages/contracts/openapi.json`) kết hợp AJV validation tại HTTP boundary.
- **Cô lập dữ liệu đa cơ sở (Multi-tenant)**: PostgreSQL Row-Level Security (`medicloud_runtime`) theo transaction context, trigger chống `UPDATE`/`DELETE`/`TRUNCATE` trên bảng `audit_events`.
- **Chống đặt trùng / vượt capacity**: Transaction + unique constraint cho slot và booking đồng thời.
- **Tích hợp & Giám sát**: Worker Outbox Relay (`apps/event-relay`), adapter chuẩn hóa FHIR R4 (`LOINC`/`UCUM`), rate limit phân tán qua Redis và metrics Prometheus tại `GET /v1/metrics`.

---

## 2. Cấu trúc thư mục

```text
MediCloud/
├── apps/
│   ├── clinical-api/        # Backend API, Prisma schema/migrations, domain services
│   ├── event-relay/         # Outbox worker gửi sự kiện lâm sàng bất đồng bộ
│   └── patient-portal/      # Next.js 15 App Router + BFF cho Patient (:3000) & Staff (:3001)
├── packages/
│   └── contracts/           # OpenAPI 1.1.0, JSON Schemas & data classification
├── tools/
│   └── perf/                # Kiểm tra query plan PostgreSQL & benchmark tải (Node + k6)
├── tests/                   # Unit, HTTP contract & PostgreSQL integration tests (Vitest)
├── Caddyfile                # Reverse proxy HTTPS/TLS cho môi trường container
├── docker-compose.yml       # Dựng toàn bộ stack (DB, API, Relay, Redis, Portals, Caddy, Backup)
└── .env.example             # Mẫu cấu hình biến môi trường
```

---

## 3. Hướng dẫn cài đặt và chạy dự án

### Cách 1: Chạy trọn bộ bằng Docker Compose (Khuyến nghị)

**Yêu cầu:** Đã cài đặt **Docker** và **Docker Compose**.

1. Clone repository và tạo tệp cấu hình môi trường:
   ```bash
   git clone https://github.com/nekooo2404/MediCloud.git
   cd MediCloud
   cp .env.example .env
   ```
2. Chỉnh sửa `.env` (nếu cần đổi mật khẩu PostgreSQL hoặc cấu hình domain/OIDC cho production).
3. Build và khởi chạy toàn bộ hệ thống chỉ với 1 lệnh:
   ```bash
   docker compose up -d --build
   ```
   Hệ thống sẽ tự động: khởi tạo PostgreSQL & Redis, chạy `prisma migrate deploy`, bật `clinical-api`, `event-relay`, `patient-portal`, `staff-portal`, `pg-backup` và `caddy` HTTPS.

4. *(Tùy chọn cho môi trường dev/staging)* Nạp dữ liệu danh mục cơ sở y tế, bác sĩ và khung giờ khám ban đầu:
   ```bash
   docker compose exec clinical-api node node_modules/tsx/dist/cli.mjs apps/clinical-api/prisma/seed.ts
   ```

---

### Cách 2: Chạy trực tiếp trên máy local (Không dùng Docker)

**Yêu cầu:** **Node.js >= 22**, **pnpm 10** (`corepack enable`), và **PostgreSQL 15/16+**.

1. Clone repo và cài đặt thư viện:
   ```bash
   git clone https://github.com/nekooo2404/MediCloud.git
   cd MediCloud
   corepack enable
   pnpm install --frozen-lockfile
   ```

2. Tạo tệp `.env` từ mẫu và cập nhật `DATABASE_URL` trỏ tới PostgreSQL local của bạn:
   ```bash
   cp .env.example .env
   ```

3. Chạy migration và sinh Prisma Client:
   ```bash
   pnpm run db:migrate:deploy
   pnpm exec prisma generate --schema apps/clinical-api/prisma/schema.prisma
   ```

4. *(Tùy chọn)* Nạp dữ liệu cơ sở/bác sĩ/lịch khám ban đầu:
   ```bash
   pnpm run db:seed
   ```

5. Build và khởi chạy các dịch vụ trên 3 terminal riêng biệt:
   - **Terminal 1 — Clinical API (`:4000`)**:
     ```bash
     pnpm run build:api
     pnpm run start:api
     ```
     *(Hoặc chạy chế độ dev reload: `pnpm run dev:api`)*
   - **Terminal 2 — Patient Portal (`:3000`)**:
     ```bash
     pnpm run build
     pnpm run start:patient
     ```
     *(Hoặc chế độ dev: `pnpm run dev:patient`)*
   - **Terminal 3 — Staff Portal (`:3001`)**:
     ```bash
     NEXT_PUBLIC_PORTAL_ROLE=staff CLINICAL_API_BASE_URL=http://127.0.0.1:4000 pnpm run start:staff
     ```
     *(Hoặc chế độ dev: `NEXT_PUBLIC_PORTAL_ROLE=staff CLINICAL_API_BASE_URL=http://127.0.0.1:4000 pnpm run dev:staff`)*

---

## 4. Địa chỉ truy cập sau khi chạy

- **Cổng Bệnh nhân (Patient Portal)**: `http://localhost:3000` (hoặc `https://localhost` qua Caddy)
- **Cổng Nhân viên y tế (Staff Portal)**: `http://localhost:3001` (hoặc `https://localhost:8443` qua Caddy)
- **Clinical API Health & Metrics**: `http://localhost:4000/v1/health` · `http://localhost:4000/v1/metrics`

---

## 5. Kiểm thử & Đánh giá hiệu năng

```bash
# Chạy toàn bộ 11 cổng kiểm tra CI (contracts, secret scan, lint, typecheck, test, build, astryx doctor)
pnpm run ci:dry-run

# Chạy bộ unit + integration test với PostgreSQL (cần biến môi trường DATABASE_URL)
pnpm test

# Kiểm tra query plan PostgreSQL dưới RLS và benchmark tải đồng thời
pnpm run perf:explain
pnpm run perf:smoke
```
