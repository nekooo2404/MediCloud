# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Người bệnh (Patient Portal, `:3000`)**: đăng ký/đặt lịch khám chuyên khoa, xác nhận đến khám (check-in), theo dõi lịch hẹn, hồ sơ sức khỏe, chỉ số sinh hiệu và lịch sử hoạt động cá nhân.
- **Nhân viên y tế & Bác sĩ (Staff Portal, `:3001`)**: tiếp nhận người bệnh tại quầy, điều phối hàng đợi, mở và hoàn tất ca khám lâm sàng (Encounters), ghi nhận chỉ số sinh hiệu (Observations) và tra cứu nhật ký nghiệp vụ.

## Product Purpose

Nền tảng y tế số tiếng Việt **MediCloud** (bản P0 dùng dữ liệu tổng hợp) kết nối quy trình đặt lịch, tiếp nhận, thăm khám lâm sàng và theo dõi sinh hiệu giữa cổng Người bệnh và cổng Nhân viên y tế thông qua BFF và Clinical API nối PostgreSQL. Thành công được đo bằng khả năng hoàn thành chính xác từng tác vụ y tế với dữ liệu nhất quán, phản hồi trạng thái trung thực và nhật ký kiểm toán minh bạch.

## Positioning

Tách riêng hoàn toàn hai cổng theo vai trò (`:3000` Người bệnh / `:3001` Nhân viên y tế) qua lớp BFF và Clinical API áp dụng kiểm soát quyền mặc định từ chối phía máy chủ (deny-by-default RBAC + cách ly tenant & hồ sơ bệnh nhân), ghi nhận nhật ký kiểm toán append-only, chống đặt trùng bằng `idempotencyKey`, và hiển thị rõ trạng thái suy giảm khi mất kết nối thay vì xác nhận giả.

## Operating Context

Giao diện web Next.js (App Router, React 19, StyleX + Astryx) vận hành song song với Clinical API (`http://127.0.0.1:4000`) và PostgreSQL; môi trường P0 hướng tới chuẩn vận hành và bảo mật doanh nghiệp.

## Capabilities and Constraints

- Chỉ dùng dữ liệu tổng hợp (synthetic data) ở giai đoạn P0; nghiêm cấm PHI/PII thật, bí mật/mật khẩu hoặc khóa riêng trong mã nguồn và nhật ký.
- Toàn bộ luồng hiển thị dùng tiếng Việt (`<html lang="vi">`) và múi giờ `Asia/Ho_Chi_Minh`.
- Mọi thao tác tạo lịch hẹn, tiếp nhận, mở ca khám, ghi sinh hiệu đều đi qua BFF -> Clinical API -> PostgreSQL và trả về lỗi tường minh khi suy giảm kết nối.
- Chưa triển khai chẩn đoán tự động, kê đơn, thanh toán/BHYT hay vận hành dữ liệu người bệnh thật trong phạm vi P0.

## Brand Commitments

Tên thương hiệu hiển thị thống nhất là **MediCloud** (thay thế hoàn toàn tên "An Tâm"); giọng văn y tế rõ ràng, điềm tĩnh, minh bạch bằng tiếng Việt.

## Evidence on Hand

- Mã nguồn giao diện và BFF tại `apps/patient-portal`.
- Dịch vụ nghiệp vụ lâm sàng và truy vấn PostgreSQL tại `apps/clinical-api`.
- Lược đồ và dữ liệu seed tổng hợp tại `apps/clinical-api/prisma/`.
- Đặc tả P0 tại `docs/medicloud/specification.md`.
- Chưa có chứng thực khách hàng thật, bảng giá hay chứng nhận lâm sàng — các tài liệu và giao diện về sau không được bịa đặt.

## Product Principles

1. **An toàn quyền máy chủ trước giao diện**: Phân quyền theo vai trò, tenant và hồ sơ bệnh nhân được cưỡng chế tại Clinical API và BFF; ẩn nút trên UI không phải ranh giới bảo mật.
2. **Không xác nhận giả khi suy giảm**: Khi kết nối cơ sở dữ liệu hoặc dịch vụ gián đoạn, giao diện hiển thị lỗi tường minh và giữ nguyên trạng thái an toàn.
3. **Dữ liệu tổng hợp minh bạch**: Toàn bộ tên hồ sơ, mã lịch hẹn và chỉ số trong bản P0 là dữ liệu tổng hợp, tách biệt rõ khỏi dữ liệu y tế thật.
4. **Tách biệt ngữ cảnh thao tác**: Không gian của Người bệnh và Nhân viên y tế được phục vụ trên hai cổng riêng biệt để giảm nhầm lẫn thao tác và bảo vệ phạm vi dữ liệu.

## Accessibility & Inclusion

Tuân thủ WCAG 2.1 AA: độ tương phản chữ tối thiểu 4.5:1 (3:1 cho chữ lớn), điều hướng bàn phím đầy đủ, viền focus hiển thị rõ ràng, hộp thoại đặt lịch có `role="dialog"` và `aria-modal="true"`, cỡ chữ chức năng và nội dung tối thiểu `12px`.
