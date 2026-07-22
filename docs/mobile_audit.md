# Mobile-Readiness Audit — 2026-07-13

Target viewport: **375px phone**. Method: 4 parallel code audits (app shell, pages A/B, shared components).

## Global root cause
The whole app is **inline-style, desktop-first, with ZERO responsive handling** — no `isMobile`, `window.innerWidth`, `matchMedia`, `useMediaQuery`, or screen `@media` anywhere (only one `@media print`). Fixes all share the same lever: introduce a shared `useIsMobile()` hook and switch fixed multi-column grids → `1fr`, shrink paddings/fonts, and make the sidebar a drawer.

## Recurring patterns that break mobile
1. Hardcoded multi-column `gridTemplateColumns` (`1fr 1fr`, `repeat(3/4,1fr)`, `minmax(280px…)`, a 5-col form) that never collapse.
2. Fixed px widths larger than the viewport (sidebar 260px, panels 450px, cover image 320px, cards).
3. Large fixed root/card padding (`2rem`–`2.5rem`) + big header fonts (`2rem`–`2.5rem`).
4. `flex` rows with no `flexWrap` (button rows, tab bars, chip rows) → horizontal overflow.
5. `width:'100vw'` on full-screen states → scrollbar-gutter horizontal scroll.

---

## 🔴 App shell (THE unblocker — blocks every page)
| File | Issue | Fix |
|------|-------|-----|
| src/layouts/MainLayout.tsx:21-31 | flex row: `<Sidebar>` + `<main flex:1 padding:2rem>`; sidebar always in flow | On mobile: full-width main, ~1rem padding, add top bar + hamburger |
| src/components/Sidebar.tsx:64-73 | `<aside width:260px>` fixed, unconditional | On mobile: off-canvas drawer (`position:fixed; translateX`), backdrop, close-on-nav |
| — | No `isMobile`/drawer state anywhere | Create `src/hooks/useIsMobile.ts` (matchMedia 768px) |
Risk: notification bell lives inside Sidebar header (Sidebar.tsx:89-212, dropdown `left:100%`) → must move to top bar on mobile. Sidebar used ONLY by MainLayout (safe). Effort: M.

## 🔴 High-traffic pages
| File | Worst issue (line) | Severity | Effort |
|------|-------------------|----------|--------|
| src/pages/Dashboard.tsx | 7 non-collapsing grids (2634,2930,2986,3107,3336,3347,3983) + charts squeezed + 2.5rem fonts (2382) + minWidth:400px header (2381) | High | L |
| src/pages/SLAMonitor.tsx | 7-col filter grid ~900px (505); modal table not scroll-wrapped (1587); modal inner grid (1442) | High | L |
| src/pages/Evaluation.tsx | filter grid repeat(4,1fr) (735); results repeat(3,1fr) (800); tab bar no-wrap (665); h1 2.25rem (659) | High | L |

## 🔴 Foreman field pages (used on-site on phones)
| File | Worst issue (line) | Severity | Effort |
|------|-------------------|----------|--------|
| src/pages/Entry.tsx | action grid 1fr 1fr (581) + 4-zone grid (599); root padding 40px (541); search 320px (569); WorkOrderCard 3-col flex + timeline (272-507) | High | M |
| src/pages/DailyReport.tsx | root grid fixed 360px sidebar (62); height calc(100vh-120px) (66) | High | M |
| src/pages/MyTracking.tsx | card 280px fixed-height 3-col flex (260-270) + cover 320px minWidth (273); inner controls no-wrap (171) | High | L |
| src/pages/WorkOrders.tsx | progress-badge flex row no flexWrap (121-144) | Low-Med | S |

## 🔴 Shared components (MasterFilter + modals)
| File | Worst issue (line) | Severity | Effort |
|------|-------------------|----------|--------|
| src/components/MasterFilter.tsx | week-chip row no-wrap overflow (126-152) + fixed height 124px (59) — used by History/Dashboard | High | S-M |
| src/components/TaskEvaluationModal.tsx | fixed panel width:450px > viewport (214) | High | S |
| src/components/ForemanReportModal.tsx | 7 non-collapsing grids incl 5-col form (1208) | High | L |
| src/components/DailyReportModal.tsx | 2-col body grid 1.2fr 1fr (323) | High | M |
| src/components/HistoryDetailModal.tsx | 1fr 1fr grids (738,751,1193,1393) + signatures 2×200px (1431-1436) + overlay 2rem pad | High | M |
| src/components/WorkOrderDetailModal.tsx | 1fr 1fr when both (188); overlay 2rem pad (47) | Med | S |
| src/components/daily-report/DailyReportDetailPane.tsx | grid minmax(280px…) 2.8fr (2784); labor table minWidth 950px | Med-High | M-L |
| src/components/daily-report/PreHandoverDetailPane.tsx | grid minmax(260px…) 2.8fr (641) | Med | M |
| src/components/AdminAssignModal.tsx | 3-col role chip grid (131) borderline | Low | S |

## 🟡 Admin / public / login (lower priority, but public QR = phone users)
| File | Issue | Severity | Effort |
|------|-------|----------|--------|
| src/pages/AdminMasterData.tsx | 5-button header no-wrap (313); 5-tab bar (376); auth card fixed 400px (267) | High | M |
| src/pages/CustomerHandover.tsx | mostly mobile-ready (maxWidth 640); task header buttons crowd (579); 100vw states (223/232/337) | Med | S |
| src/pages/OwnerReview.tsx | essentially mobile-ready; only 100vw nits (84/93/173) | Low | S |
| src/pages/MyDrafts.tsx | grid minmax(350px,1fr) overflows ~343px container (46) | Med | S |
| src/pages/Login.tsx | mobile-safe; only outer 100vw (44) | Low | S |

## ⛔ Correctness bug found during audit (NOT mobile — a crash)
**src/pages/CustomerHandover.tsx:665,679** use `<User>` and `<Phone>` lucide icons that are **NOT imported** (import list L6-10). When a customer taps "แก้ไข" (reject) on the public QR page, the contact-input block renders → ReferenceError → white screen. Fix: add `User, Phone` to the lucide-react import. Public-facing → P0.

## Suggested sequencing
1. App shell (T-002) — unblocks seeing every other page on mobile. Do FIRST.
2. Shared MasterFilter + top modals (T-005) — reused everywhere, high leverage.
3. High-traffic pages (T-003), foreman field pages (T-004).
4. Admin/public/login polish (T-006) + small nits (pool).
5. CustomerHandover crash (T-007) — do ASAP, independent of mobile work.
