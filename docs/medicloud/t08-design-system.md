# MediCloud T08 Design System & Multi-Skill Synthesis

**Task:** T08 — Patient & Staff Appointment Scheduling and Check-In Portal  
**Precedence:** `T08-PORTAL-001` (`Project Owner -> CONSTITUTION.md -> Approved Decisions -> AGENTS.md (Astryx v0.7.17) -> .agents/skills/`)  
**Language:** Tiếng Việt (`<html lang="vi">`) · **Data:** Synthetic only (zero real PHI/PII)

---

## 1. Visual Direction (UI/UX Pro Max + Impeccable Operate/Read Mode)

- **Surface Mode (`impeccable/reference/mode-operate.md`):** **Operate**. Users (patients booking/checking appointments and receptionists checking patients in) arrive to complete clinical scheduling tasks accurately, with zero marketing fluff or visual noise.
- **UI/UX Pro Max Design Intelligence (`clinic dashboard medical appointment management`):**
  - **Style:** *Accessible & Ethical* — light + dark parity, crisp contrast (>=4.5:1 text, >=3:1 focus ring/icons), tabular numbers for timestamps and slot capacity, semantic SVG/Astryx icons only (zero emojis).
  - **Palette Seeds (implemented via Astryx Theme Editor `medicloud`):**
    - `accent`: `#0F766E` (calm clinical teal, passes white `--color-on-accent` contrast >=4.5:1)
    - `neutral`: `#475569` (clinical slate grays)
    - `success`: `#15803D`, `warning`: `#B45309`, `danger`: `#B91C1C`, `info`: `#0369A1`
  - **Typography:** Bundled `Figtree` (local `.woff2` via Astryx `neutral` base, supporting Vietnamese diacritics `U+0100-02BA`, `U+1E00-1E9F`, `U+1EF2-1EFF` with zero network font wait).

---

## 2. Anti-Slop Floor & Restraint Rules (Hallmark + Impeccable + Taste-Skill)

1. **No AI-slop tells:** Zero eyebrows/kickers above headings, zero "01/02/03" decorative step cards, zero purple-to-blue gradients, zero resting drop shadows or card-inside-card nesting, zero middle-dot concatenated metadata (`A · B · C`), zero arrows glued onto button labels (`->`), zero fake metrics or testimonials.
2. **Job-Driven Anatomy (`hallmark` + `impeccable`):**
   - Immediate task shell via Astryx `AppShell` + `TopNav` / `MobileNav`:
     1. **Đặt lịch khám** (filter specialty/doctor -> inspect slots -> confirm booking -> verified receipt with `correlation_id`)
     2. **Lịch hẹn & Tra cứu** (UUID lookup form with blur/submit validation -> table/list -> `Drawer` detail inspector)
     3. **Quầy tiếp nhận** (staff check-in queue with `SegmentedControl` status filter -> `AlertDialog` confirmation -> idempotent check-in)
3. **Astryx Component Purity (`AGENTS.md`):**
   - Zero raw `<div>`/`<span>` tags; all layout via `AppShell`, `Layout`, `Section`, `VStack`, `HStack`, `Grid`, `Card` (only where clear interaction boundaries exist), `Table`, `List`/`ListItem`, `Dialog`, `AlertDialog`, `Drawer`, `Banner`, `EmptyState`, `Skeleton`.
   - Zero raw `#hex` or `px` in app CSS; token variables (`var(--color-*)`, `var(--spacing-*)`, `var(--radius-*)`) only.
4. **Modern Web Guidance Compliance:**
   - `forms` & `validate-input-after-interaction`: semantic `<search>` and `<form aria-labelledby="...">`, visible labels, hints placed above inputs (`description`), validation shown on blur/submit and cleared on edit, never premature on page load; `isLoading` disables double-post without dropping keyboard focus.
   - `accessibility`: single `<h1>` per active view, logical heading order, `StatusDot` paired with text, keyboard-accessible scrollable table container (`role="region"` + `tabIndex={0}`), instant `:focus-visible` indicator.
   - `responsive-table`: desktop `Table` adapts via container query / responsive `List` on `< 768px` mobile viewports so zero horizontal overflow (`scrollWidth <= clientWidth`) occurs at `1440x900`, `768x1024`, and `390x844`.
5. **Degraded State Integrity (`specification.md` AC-10):**
   - Any private-boundary failure (`503 private_boundary_degraded`) surfaces an assertive `Banner` (`role="alert"`) displaying the exact `correlation_id`, stating clearly that no appointment or check-in was confirmed, and offering an explicit retry action.
