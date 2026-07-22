dt: 2026-07-09
task: T-335 — collectionGroup delta-listener + flat cache full port (/dashboard read-cost)
sk: coding
sk_h: 0af9cdaed0a87a786b90e59debed8c41893ab16d
mece_h: ce1bb015
p1: done
p2: done
p3: in_progress
section: S4
step: wire cache into WorkOrderContext — add useRealtimeWorkOrders(!!user) + useMemo(assembleWorkOrders(cache, baseWOs)) → setAllWorkOrders; keep fetchSubcollections unused until verified; replace per-WO fetch loop L579-589
resume_at: S4 wire → S5=N/A (no status filter → no index) → S6 leak-fix + touch-write removal + dead fetchSubcollections + runtime verify
sections_done: S1,S2,S3
mece_plan: .sessions/mece_plan.md (section [X] boxes = source of truth)
handoff: .sessions/session_handoff.md
session_reset: not_armed
note: /compact checkpoint AFTER S3 (foundation S1-S3 done + verified tsc=68). Task NOT complete. S4 is the high-blast WorkOrderContext wiring — resume in fresh context. Resume by reading mece_plan.md first pending [ ] (S4).
