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

<!-- impeccable:design-map -->
Name: MediCloud
Colors: primary: clinical-emerald #126b56; neutral: mist-canvas #f5f8f7; warning: warm-amber-alert #924c08; danger: clinical-crimson #b91c1c; primary: clinical-emerald-deep #0f6350 (+12 more in the sidecar)
Fonts: Figtree (display, headline, title, body, label)
Spacing: xs 8px, sm 12px, md 16px, lg 20px, xl 28px
Radius: sm 8px, md 10px, lg 12px, xl 16px, modal 18px, pill 99px
North Star: "The Calm Clinical Sanctuary"
Rules:
- The Clinical Contrast Rule. Mọi chữ >= 4.5:1 (WCAG AA); cấm xám dưới ngưỡng đọc.
- The Mint Surface Pairing Rule. Nền `soft-mint-wash` ghép `clinical-emerald-deep`.
- The 12px Clinical Floor Rule. Cấm cỡ chữ < `12px` ở mọi thành phần.
- The Tabular Clinical Figures Rule. Bật `tabular-nums` cho mọi số KPI, ngày giờ, badge.
- The Flat-By-Default Rule. Thẻ và KPI nghỉ luôn phẳng viền `1px`.
Don't:
- Don't dùng `Arial`, eyebrow trên `<h1>`, hoặc tên "An Tâm" (thống nhất là MediCloud).
- Don't thêm `:root` overrides vào CSS toàn cục khi dùng Astryx theme.
Do:
- Do giữ cỡ chữ >= `12px` và tương phản >= `4.5:1` trên `:3000` và `:3001`.
- Do dùng `Figtree` kèm `tabular-nums` cho KPI và mốc thời gian.
- Do báo lỗi `role="alert"` khi BFF/API suy giảm, không xác nhận giả.
- Do cân bằng hai cột đầu trang bằng cắt trang kèm nút mở rộng.
Map: apps/patient-portal/components/health-dashboard.tsx
Full: .impeccable/design-full.md (read a section when you need its detail)
