# T05-API-001 — Phê duyệt thiết kế API đặt lịch (bản tiếng Việt)

**Mã quyết định:** T05-API-001  
**Ngôn ngữ:** Tiếng Việt  
**Trạng thái:** ĐÃ PHÊ DUYỆT  
**Người phê duyệt yêu cầu:** Chủ dự án  
**Chủ sở hữu miền:** Scheduling/API và dữ liệu  
**Chủ sở hữu triển khai:** Coding agent được chỉ định sau khi phê duyệt  
**Tester độc lập:** `quality.tester`, bắt buộc sau triển khai  
**Dữ liệu:** Chỉ dữ liệu tổng hợp (synthetic); cấm PHI/PII thật, bí mật, token và thông tin hồ sơ bệnh nhân thật.

## 1. Quyết định cần phê duyệt

Phê duyệt thiết kế API T05 cho các chức năng xem lịch, đặt lịch, khóa sức chứa và bảo đảm idempotency. Việc phê duyệt này chỉ cho phép triển khai và kiểm thử trong phạm vi được nêu dưới đây.

Phê duyệt **không** cho phép triển khai production, sử dụng dữ liệu thật, công bố tuân thủ pháp lý, chứng nhận an toàn lâm sàng, đo lường hiệu năng chưa có bằng chứng, hoặc mở rộng sang các API ngoài phạm vi.

Sau khi được phê duyệt, T05 mới đủ điều kiện chuyển từ `GATED: API approval` sang `IMPLEMENTING`. Trước thời điểm đó, không được cập nhật trạng thái T05 và không được triển khai mã sản phẩm.

## 2. Phạm vi và đường dẫn được phép ghi

Các đường dẫn được phép thay đổi trong T05:

- `apps/clinical-api/`
- `tests/`
- `packages/contracts/`

Các tài liệu handoff, bằng chứng, quyết định và trạng thái task chỉ được cập nhật khi có artifact tương ứng và theo đúng các gate độc lập. Không được ghi ra ngoài thư mục dự án MediCloud.

## 3. Phụ thuộc và điều kiện đầu vào

- T02 — hợp đồng API, envelope sự kiện và phân loại dữ liệu: `TEST_PASSED`, quyết định `T02-CONTRACTS-001` đã `APPROVED`.
- T03 — schema PostgreSQL/Prisma và dữ liệu tổng hợp: `TEST_PASSED`, quyết định schema đã `APPROVED`.
- T04 — xác thực OIDC và ủy quyền RBAC/ABAC: `TEST_PASSED`, quyết định `T04-SECURITY-001` đã `APPROVED`.
- `tenant_id` phải được suy ra từ session/membership đã xác thực ở backend; không tin cậy giá trị tenant do client cung cấp.
- Chỉ sử dụng fixture và bản ghi tổng hợp. Nếu thiếu môi trường tích hợp hoặc quyền truy cập cần thiết, kết quả phải là `BLOCKED`, không phải `PASS`.

## 4. Hợp đồng API được triển khai

Các endpoint dùng tiền tố `/v1` và bearer token OIDC theo hợp đồng T02:

| Phương thức | Đường dẫn | Mục đích |
| --- | --- | --- |
| `GET` | `/slots?doctor_id={id}&from={iso}&to={iso}` | Liệt kê các slot được phép xem; không tiết lộ dữ liệu bệnh nhân |
| `POST` | `/appointments` | Tạo lịch hẹn cho slot còn sức chứa |
| `GET` | `/appointments/:id` | Lấy lịch hẹn khi người gọi có quyền |
| `POST` | `/appointments/:id/check-in` | Check-in theo vai trò và cùng tenant |

Quy tắc chung:

- Lỗi có dạng `{error: {code, message, correlation_id, details?}}`; không trả stack trace hoặc nội dung lâm sàng.
- `401` dành cho xác thực thiếu/không hợp lệ; `403` dành cho đã xác thực nhưng không được phép; `404` có thể dùng để tránh tiết lộ sự tồn tại của tài nguyên.
- Mọi mutation phải có `correlation_id` trong phản hồi và log tương ứng không chứa dữ liệu nhạy cảm.
- Header `Idempotency-Key` và trường body `idempotency_key` phải biểu thị cùng một request; lệch nhau trả `409`.
- Header có độ dài từ 16 đến 128 ký tự; body không có trường ngoài hợp đồng.

## 5. Semantics đặt lịch, sức chứa và idempotency

1. Backend kiểm tra session, membership đang hoạt động, tenant, quyền thao tác, ownership/delegation và trạng thái tài nguyên theo T04.
2. Backend đọc slot theo tenant và khóa/ cập nhật sức chứa trong cùng transaction với việc tạo appointment.
3. Không được tạo appointment nếu slot không còn sức chứa; concurrency không được làm `booked_count` vượt `capacity`.
4. Appointment và outbox event `appointment.created` được ghi trong cùng một transaction theo hợp đồng T02.
5. Cùng một `(tenant_id, idempotency_key)` phải trả lại kết quả appointment ban đầu và không tạo bản ghi thứ hai.
6. Cùng key nhưng request payload có ý nghĩa khác phải bị từ chối an toàn (ví dụ `409`), không được tái sử dụng key cho tài nguyên khác.
7. Thất bại transaction phải không để lại appointment thành công một phần hoặc tăng sức chứa một phần.
8. Không log idempotency key đầy đủ, bearer token, dữ liệu nhận diện, dữ liệu lâm sàng hoặc payload nhạy cảm.

## 6. Acceptance criteria

| ID | Tiêu chí chấp nhận | Bằng chứng bắt buộc |
| --- | --- | --- |
| T05-AC-01 | Request hợp lệ lấy được các slot thuộc phạm vi tenant/ủy quyền; không lộ dữ liệu bệnh nhân. | Unit/integration test và response fixture đã loại nhạy cảm |
| T05-AC-02 | Request đặt lịch hợp lệ tạo đúng một appointment cho slot còn chỗ. | API test, DB assertion và correlation ID |
| T05-AC-03 | Đặt lịch đồng thời không vượt `capacity`; các request thừa nhận lỗi an toàn. | Concurrent booking test, kết quả transaction và DB assertion |
| T05-AC-04 | Lặp lại cùng idempotency key trả đúng kết quả ban đầu và không tạo appointment thứ hai. | Replay test và unique-constraint assertion |
| T05-AC-05 | Header/body key lệch nhau, key không hợp lệ hoặc payload thừa bị từ chối. | Validation/negative tests |
| T05-AC-06 | Tenant A hoặc bệnh nhân không được phép không thể đọc/mutate tài nguyên của tenant B/người khác. | Negative authorization test và audit assertion |
| T05-AC-07 | Appointment và outbox event được commit atomically; lỗi giữa transaction không tạo dữ liệu dở dang. | Transaction rollback test và outbox evidence |
| T05-AC-08 | Check-in chỉ được thực hiện bởi vai trò và tenant phù hợp; chuyển trạng thái không hợp lệ bị từ chối. | Role/state matrix tests |
| T05-AC-09 | Error response có correlation ID và không chứa token, PHI/PII, stack trace hay raw claims. | Response scan và redacted-log test |

## 7. Ràng buộc bảo mật và dữ liệu

- Backend authorization là ranh giới bảo mật; kiểm tra UI không được thay thế guard/policy backend.
- Mọi truy vấn dữ liệu tenant phải có tenant scope và điều kiện ownership/assignment phù hợp.
- Dữ liệu lâm sàng restricted không được đưa vào response scheduling hoặc event payload.
- Sự kiện cross-cloud chỉ được dùng payload allowlist của T02, tối thiểu gồm `appointment_ref` và `channel` cho `appointment.created`.
- Không thêm break-glass, wildcard privilege, public database exposure hoặc cơ chế bypass để làm test pass.
- Chỉ dùng dữ liệu tổng hợp trong code, test, log, artifact và báo cáo.

## 8. Kế hoạch kiểm thử và bằng chứng

Tester độc lập phải chạy trên đúng diff implementation và phát hành `TestReport` có:

- lệnh/input thực tế, exit code hoặc assertion result, timestamp và môi trường;
- fingerprint của diff được kiểm thử;
- unit test cho validation, idempotency và chuyển trạng thái;
- integration test với Prisma/PostgreSQL tổng hợp;
- concurrency test cho capacity locking;
- negative authorization và tenant-boundary tests;
- transaction rollback/outbox atomicity tests;
- payload/log redaction checks;
- danh sách rõ các kiểm tra không chạy và lý do.

Các gate bắt buộc sau implementation: `Ownership -> Tester -> Code Review -> Security/Privacy -> Evidence`. Thiếu tester hoặc bằng chứng khớp diff thì không được chuyển sang pass.

## 9. Rủi ro và điều kiện escalation

- Thiếu PostgreSQL/integration environment hoặc quyền cần thiết: `BLOCKED`.
- Phát hiện truy cập cross-tenant thành công, PHI/PII/bí mật, frontend-only authorization, capacity race, hoặc event không atomic: hard-fail/escalate.
- Thay đổi schema, authorization, event contract, tenant boundary hoặc payload allowlist sau phê duyệt này làm mất hiệu lực phê duyệt và yêu cầu quyết định mới.
- Bản thiết kế này không chứng minh deployment, production readiness, hiệu năng, legal compliance hoặc clinical safety.

## 10. Approval record

**Quyết định:** ĐÃ PHÊ DUYỆT  
**Người phê duyệt:** Chủ dự án  
**Thời điểm:** 2026-11-21  
**Văn bản phê duyệt:** Tôi phê duyệt `T05-API-001`, với phạm vi và các điều kiện được nêu trong `docs/decisions/t05-api-approval-vi.md`.  
**Điều kiện/ngoại lệ:** Không phê duyệt production deployment, dữ liệu thật, legal compliance, clinical safety hoặc performance claim.
