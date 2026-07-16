# Mobile Redesign Mockups — Design → Code Index

> Ground-truth 375px mockups for the T-010 mobile-first redesign. Built mockup-first
> (faithful: verbatim copy + real lucide icons, only layout/type-scale/wrapping changed).
> **When coding a screen: open its frame here first, match the layout/type-scale/pattern,
> keep copy + icons verbatim (the mockup already mirrors the source).** Open the `.html`
> files in a browser at a 375px viewport.

## Files
- `t010-group1.html` — forms / lists foundation
- `t010-group2.html` — dense analytics (Dashboard + SLAMonitor)
- `t010-group3.html` — public portals / stateful pages / auth
- `t010-group4.html` — 9 shared cross-page modals (M1–M9)
- `t010-group5.html` — DailyReport sub-modal cluster + overlays

## Frame → source file → owning task

### Group 1 — forms / lists
| Frame | Source file | Task |
|---|---|---|
| Drawer เมนู | MainLayout / Sidebar.tsx | T-002 (done — ref only) |
| แจ้งเตือน (notification dropdown) | NotificationBell.tsx | T-010 polish |
| S2 · Entry (ใบงานและติดตามผล) | src/pages/Entry.tsx | **T-010 S2** |
| S3 · DailyReport / WorkOrderGroupList | src/pages/DailyReport.tsx | **T-010 S3** |
| S4 · History (ประวัติงาน) | src/pages/History.tsx | **T-010 S4 / T-001** |
| ฟอร์มแจ้งซ่อม · Step form | Entry.tsx report form | **T-010 S2** |
| ฟอร์มรายงานผลรายวัน | DailyReport form | **T-010 S3** |
| QR ส่งมอบ (Handover) | CustomerHandover.tsx | **T-010 S7** |
| ตรวจสอบก่อนส่งรายงาน | PreHandover summary (daily-report) | **T-010 S3** |
| สรุปผลงาน (Work Summary) | DailyReport summary | **T-010 S3** |

### Group 2 — dense analytics
| Frame | Source file | Task |
|---|---|---|
| S4a · ปฏิบัติการ / S4b · โดนัทความคืบหน้า | Dashboard.tsx (operations) | **T-010 S5** |
| S5 · ผลงาน (Insights) | Dashboard.tsx (insights) | **T-010 S5** |
| S6 · Analytics (dense table + Project Health) | Dashboard.tsx | **T-010 S5** |
| S7a · บอร์ดติดตาม / S7b · รอลูกค้าประเมิน | SLAMonitor.tsx | **T-010 S6** |
| WOSummaryModal · TaskHistoryModal | Dashboard.tsx (page-local) | T-005 quality-pass |
| Labor Detail Modal · Daily Report History (SLA) · AdminAssignModal (SLA) | Dashboard / SLAMonitor | T-005 quality-pass |

### Group 3 — portals / stateful / auth
| Frame | Source file | Task |
|---|---|---|
| S8a · Login ปกติ / S8b · error + โชว์รหัส | src/pages/Login.tsx | **T-010 S7 / T-006** |
| S9a · หน้าตรวจรับหลัก / S9b · ฟอร์มอนุมัติ·ตีกลับ / S9c-1·2 · หลังส่ง | src/pages/OwnerReview.tsx | **T-010 S7** |
| S10a·b · CustomerHandover Branch B (After-Sale) | CustomerHandover.tsx | **T-010 S7** |
| S11 · CustomerHandover Branch A (PreHandover) | CustomerHandover.tsx | **T-010 S7** |
| S12a·b · CustomerInspection (admin-side modal, defect + 5-dim eval) | admin inspection modal | T-006 |

### Group 4 — 9 shared cross-page modals
| Frame | Source file | Task |
|---|---|---|
| M1 · HistoryDetailModal (a normal / b rejected) | HistoryDetailModal.tsx | T-005 quality-pass |
| M2 · TaskReviewModal (tabs approve/reject + QR) | TaskReviewModal.tsx | T-005 quality-pass |
| M3 · TaskEvaluationModal (right drawer + nested confirm) | TaskEvaluationModal.tsx | T-005 quality-pass |
| M4 · CloseJobModal | CloseJobModal.tsx | T-005 quality-pass |
| M5 · WorkOrderDetailModal | WorkOrderDetailModal.tsx | T-005 quality-pass |
| M6 · AdminAssignHelperModal | AdminAssignHelperModal.tsx | T-005 quality-pass |
| M7 · PreHandoverAssignModal | PreHandoverAssignModal.tsx | T-005 quality-pass |
| M8 · MasterDataModal (Staff) | MasterDataModal.tsx | T-006 |
| M9 · MasterFilter (inline card) | MasterFilter.tsx | T-005 quality-pass |

### Group 5 — DailyReport sub-modal cluster + overlays
| Frame | Source file | Task |
|---|---|---|
| ① BatchAddModal (Internal + Outsource variant) | daily-report/BatchAddModal.tsx | **T-010 S3** |
| ② DailyReportSummaryModal (edit + diff badges) | daily-report/DailyReportSummaryModal.tsx | **T-010 S3** |
| ③ PreHandoverSummaryModal (variant of ②) | daily-report/PreHandoverSummaryModal.tsx | **T-010 S3** |
| ④ AnalogTimePicker (overlay — already mobile-first, keep) | AnalogTimePicker.tsx | **T-010 S3** |
| ⑤ ImageOverlay (fullscreen gallery — keep) | ImageOverlay.tsx | **T-010 S3** |

## Desktop → mobile transform patterns encoded in these mockups
(the reusable rules coders apply — full detail in roadmap T-011 Learned-G2..G5)
- **Type scale** (mobile/desktop): display 28/40 · h1 20/32 · h2 16/22 · h3 15/18 · body 14/16 · label 12/13 · code 13/14 (mono, nowrap). Identifier codes = nowrap on one line.
- **Chip rows** → horizontal-scroll (overflow-x auto, flex-nowrap), never wrap-bloat.
- **Dense/wide table** → its own horizontal-scroll frame + "swipe ←→" hint (never page-level scroll); keep colored group-header spans.
- **Kanban N columns** → collapsible stacked accordion rows (dot color + count badge).
- **Charts** (donut/gauge/bar) → keep as SVG, radii mobile-gated so they fit the shrunk container.
- **Stat grid** repeat(3–4,1fr) → 2×2; two-panel row (list+chart) → stack full-width.
- **Modal → mobile chrome**: full-screen / bottom-sheet; header pinned top + footer buttons pinned bottom; body scrolls; keep source gradient header color.
- **Already mobile-first** (Login, public QR portals, AnalogTimePicker, ImageOverlay): keep layout — only touch-target ≥44px + type-scale fixes. Do NOT over-restructure.
- Touch targets ≥44px · mobile card padding 12 · gap 8–12 · long-label buttons → full-width or icon+short.
