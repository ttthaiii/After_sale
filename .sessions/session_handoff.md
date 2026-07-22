# Session Handoff — T-337 Admin dashboard: clone FM insights + all-work YEAR dimension
skill_name: coding
task: Make admin /dashboard mirror the FM ผลงาน (insights) view fully, plus an admin-only "view all work" dimension scoped by YEAR (default current year, year picker for history). Month filter stays as drill-down. Operations (ปฏิบัติการ) view stays FM-only.
phase: in_progress (compact-checkpoint — more work after /compact)

## DONE this session (all in src/pages/Dashboard.tsx; tsc: no NEW errors)
- S1: FM Performance Hero Card now renders for admin too (removed `isForeman ?` ternary at ~2984; deleted the 4 legacy admin StatCards). Foreman unchanged.
- S2: added state `const [isAllTime, setIsAllTime] = useState(isAdminOrManager)` (~927); wired MasterFilter (~2499) with allowAllTime/isAllTime/setIsAllTime (MasterFilter already had this API + auto-disables week selector when all-time).
- S3: month-window bypass when isAllTime in: filteredData (~1220), getDashboardStats (~1336, uses -Infinity/+Infinity + current year/month fallback for hidden daily/label code), healthCardProjects (~1867), availableProjectsThisMonth isActive (~1187). isAllTime added to each dep array.
- S4: hide Activity Calendar (`&& !isAllTime` guard ~3149) + S-Curve (`display: isAllTime ? 'none'` ~3274) in all-time; progress label ~3132 → "ความคืบหน้าทั้งหมด" when all-time.
- S6: baseAccessibleWOs (~1118) unlocked for all-time — the `if (isAdminOrManager && !hasAdminFilter && !isComparisonMode) return []` gate now also checks `&& !isAllTime`, and the fetch branch triggers on `|| isAllTime`, so admin sees EVERY WO in the system without picking a filter. isAllTime added to deps.

## PENDING (do after /compact — needs fresh Phase 1 gather)
### (A) YEAR dimension — replaces "all-time forever"
- Current isAllTime = all-time forever. Change to: all work of a SELECTED YEAR.
- Add `selectedYear` state (default = current year). When all-time/all-work mode: window = [startOfYear(selectedYear), endOfYear(selectedYear)] instead of ±Infinity — apply in the same 4 memos as S3 + baseAccessibleWOs(S6) if year-scoping the source.
- Add a YEAR selector to MasterFilter.tsx (it only has month nav + all-time toggle today). Keep it minimal/consistent with existing style.
- Re-verify the S3 math with year window (carriedOver/newThisMonth semantics across a year).

### (B) Insights-section parity (admin ผลงาน view == FM ผลงาน view)
- Inspect role branches inside insights render: Dashboard.tsx ~3153 `{(!isForeman && !selectedForemanId && !selectedSCurveProject) ? (empty-state) : (calendar)}`, ~3175/3178 (currentUserId/allForemenForProject foreman-vs-admin), ~3186 `{!isForeman && <grid 1.4fr 1fr>}` (admin-only block — decide align/keep).
- Goal: every section FM sees in insights, admin also sees (data admin-scoped). Operations view NOT cloned.

## Verify after implementing
- npx tsc --noEmit -p tsconfig.app.json → grep Dashboard.tsx/MasterFilter.tsx → no NEW errors (baseline = 69 pre-existing, incl. DashboardStats type gaps for closedWOsInScope/pendingAdminEval — runtime-safe, out of scope).
- Runtime (user): admin default = all work of current year in FM-style insights; year picker switches years; month nav drills to a month (calendar+S-Curve reappear); foreman view identical to before.

## Scope
Files: src/pages/Dashboard.tsx + src/components/MasterFilter.tsx (year picker). Anything else = [scope-creep].
mece_plan.md has S1-S6 marked; add Phase for (A)+(B) post-compact.
