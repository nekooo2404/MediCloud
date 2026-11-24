---
name: "MediCloud"
description: "Nền tảng y tế số tiếng Việt tách cổng Người bệnh và Nhân viên y tế"
colors:
  clinical-emerald: "#126b56"
  clinical-emerald-deep: "#0f6350"
  soft-mint-wash: "#e8f7f1"
  mist-canvas: "#f5f8f7"
  pure-surface: "#ffffff"
  deep-pine-ink: "#153d38"
  pine-slate: "#254440"
  muted-pine: "#4b615d"
  subtle-pine: "#526965"
  hairline-mist: "#e8efed"
  control-border: "#cfe0db"
  warm-amber-alert: "#924c08"
  warm-amber-wash: "#fff4e5"
  warm-umber: "#735320"
  warm-cream-notice: "#fffaf0"
  clinical-crimson: "#b91c1c"
  soft-rose-wash: "#fff1f0"
typography:
  display:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(24px, 2.6vw, 30px)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0em"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  modal: "18px"
  pill: "99px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.clinical-emerald}"
    textColor: "{colors.pure-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "11px 16px"
  button-secondary:
    backgroundColor: "{colors.pure-surface}"
    textColor: "{colors.pine-slate}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "7px 11px"
  nav-item-active:
    backgroundColor: "{colors.soft-mint-wash}"
    textColor: "{colors.clinical-emerald-deep}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  status-badge:
    backgroundColor: "{colors.soft-mint-wash}"
    textColor: "{colors.clinical-emerald-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
  status-badge-warning:
    backgroundColor: "{colors.warm-amber-wash}"
    textColor: "{colors.warm-amber-alert}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
  card-surface:
    backgroundColor: "{colors.pure-surface}"
    textColor: "{colors.deep-pine-ink}"
    rounded: "{rounded.xl}"
    padding: "16px 18px"
  input-field:
    backgroundColor: "{colors.pure-surface}"
    textColor: "{colors.deep-pine-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  modal-dialog:
    backgroundColor: "{colors.pure-surface}"
    textColor: "{colors.deep-pine-ink}"
    rounded: "{rounded.modal}"
    padding: "20px"
    width: "580px"
---

# Design System: MediCloud

## Overview

**Creative North Star: "The Calm Clinical Sanctuary"**

MediCloud là giao diện vận hành (Operate mode) cho Người bệnh (`:3000`) và Nhân viên y tế (`:3001`), ưu tiên đọc nhanh lịch hẹn và chỉ số lâm sàng trên nền sương ngọc với thẻ trắng viền `1px`.

**Key Characteristics:**
- Dùng chung linh kiện tại `apps/patient-portal/components/health-dashboard.tsx` cho 2 cổng tách vai trò.
- Bề mặt phẳng phân lớp bằng viền mảnh (`Flat & Hairline-Layered`).
- Tương phản >= `5.5:1`; bộ chữ cục bộ `Figtree` kèm `tabular-nums`.

## Colors

### Primary
- **Clinical Emerald** (`clinical-emerald`): CTA chính, nút dòng, tab link.
- **Clinical Emerald Deep** (`clinical-emerald-deep`): Chữ/icon trên nền `soft-mint-wash`.
- **Soft Mint Wash** (`soft-mint-wash`): Nền nav chọn, icon KPI, pill xác nhận.

### Neutral
- **Mist Canvas** / **Pure Surface**: Nền khung trang và nền thẻ/topbar/modal.
- **Deep Pine Ink** / **Pine Slate**: Tiêu đề, KPI, nút phụ, chip sinh hiệu.
- **Muted Pine** / **Subtle Pine**: Nav thường, phụ đề, meta, placeholder.
- **Hairline Mist** / **Control Border**: Viền `1px` phân tách và viền ô nhập.

### Semantic Status
- **Warm Amber Alert** / **Warm Amber Wash**: Chờ tiếp nhận, ca mở, badge.
- **Warm Umber** / **Warm Cream Notice**: Lưu ý điều phối.
- **Clinical Crimson** / **Soft Rose Wash**: Lỗi `role="alert"`.

**The Clinical Contrast Rule.** Mọi chữ >= 4.5:1 (WCAG AA); cấm xám dưới ngưỡng đọc.
**The Mint Surface Pairing Rule.** Nền `soft-mint-wash` ghép `clinical-emerald-deep`.

## Typography

**Display & Body Font:** Figtree (cục bộ, zero network wait; fallback hệ thống sans-serif)
- **Display** (`700`, `clamp(24px, 2.6vw, 30px)`, `1.2`, `-0.025em`): `<h1>`.
- **Headline** (`700`, `24px`, `1.15`, `-0.025em`): KPI & biểu đồ (`tabular-nums`).
- **Title** (`700`, `15px`, `1.35`): Tiêu đề thẻ (modal `17px`).
- **Body** (`400`, `14px`, `1.5`): Phụ đề trang (`13px`–`14px`).
- **Label** (`600`–`700`, `12px`, `1.4`): Nhãn, nút phụ, badge, meta.

**The 12px Clinical Floor Rule.** Cấm cỡ chữ < `12px` ở mọi thành phần.
**The Tabular Clinical Figures Rule.** Bật `tabular-nums` cho mọi số KPI, ngày giờ, badge.

## Layout

- **Desktop (`>= 960px`)**: Sidebar `260px` + topbar `72px` + khung `1440px`.
- **KPI (`>= 760px`)**: Lưới 4 cột (`2` cột màn hẹp), gap `12px`.
- **Grid (`>= 1100px`)**: `1.55fr` / `0.9fr`, gap `16px`. Tổng quan `2` lịch + `3` mốc; tab con `4` mục (hàng đợi `3`) + nút mở rộng.
- **Mobile (`< 960px`)**: Menu gập + thanh đáy `mobileNav`.

## Elevation & Depth

Phẳng viền `1px`, bóng đổ chỉ cho CTA, toast và modal:
- `0 4px 12px rgba(18, 107, 86, 0.2)` (CTA)
- `0 10px 28px rgba(15, 38, 35, 0.22)` (Toast `role="status"`)
- `0 24px 60px rgba(15, 38, 35, 0.25)` (Modal `role="dialog"`)

**The Flat-By-Default Rule.** Thẻ và KPI nghỉ luôn phẳng viền `1px`.

## Shapes

`8px` (`sm`) nút dòng/chip; `10px` (`md`) CTA/nav/search; `12px` (`lg`) ô ngày/toast/thẻ giờ; `16px` (`xl`) thẻ/KPI; `18px` (`modal`) hộp thoại; `99px` (`pill`) badge.

## Components

Cảm giác tinh gọn, tiết chế (`refined & restrained`), viền focus `2px`.
- **Buttons**: CTA chính nền xanh ngọc chữ trắng (`11px 16px`, bo `10px`); nút phụ viền `control-border`.
- **Badges & Cards**: Pill `99px` (`5px 10px`, `12px`); thẻ bo `16px`, viền `1px solid hairline-mist`.
- **Inputs & Navigation**: Ô nhập viền `control-border` (`13px`); sidebar `13px` (`aria-current="page"`); mobile đáy `12px`.
- **Booking Modal**: `role="dialog"` (`aria-modal="true"`, `580px`), Escape/backdrop, lọc khoa và `idempotencyKey`.

## Do's and Don'ts

### Do:
- **Do** giữ cỡ chữ >= `12px` và tương phản >= `4.5:1` trên `:3000` và `:3001`.
- **Do** dùng `Figtree` kèm `tabular-nums` cho KPI và mốc thời gian.
- **Do** báo lỗi `role="alert"` khi BFF/API suy giảm, không xác nhận giả.
- **Do** cân bằng hai cột đầu trang bằng cắt trang kèm nút mở rộng.

### Don't:
- **Don't** dùng `Arial`, eyebrow trên `<h1>`, hoặc tên "An Tâm" (thống nhất là MediCloud).
- **Don't** thêm `:root` overrides vào CSS toàn cục khi dùng Astryx theme.
