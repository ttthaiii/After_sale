// audit-wo-status.mjs — READ-ONLY audit. Does NOT write anything to Firestore.
//
// Purpose (T-339): find WOs whose STORED `status` disagrees with the status
// re-derived live from their tasks (deriveWoStatus). A disagreement = a stale
// stored status left over from before the status redesign — the reason the
// /dashboard cards under-count.
//
// Scope condition (user): ONLY audit work orders with type in
// {'PreHandover','AfterSale'}. Every other type belongs to the labor system.
//
// deriveWoStatus below is a faithful inline copy of src/utils/deriveWoStatus.ts
// (kept in sync by hand — this is a one-off diagnostic, no TS loader in .mjs).
//
// Run:  node scripts/audit-wo-status.mjs

import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../key/after-sale-key.json'), 'utf8'));
let app; try { app = getApp(); } catch { app = initializeApp({ credential: cert(sa), projectId: 'after-sale-system' }); }
const db = getFirestore(app);

// ---- deriveWoStatus (mirror of src/utils/deriveWoStatus.ts) -----------------
const REV0 = 'rev00';
const isClosed = (t) =>
    t.status === 'Complete' || t.status === 'Cancelled' ||
    (t.status === 'Rejected' && t.taskArchived === true);
const reachedCustomer = (tasks) => tasks.some(t =>
    t.status === 'pending_delivery' || t.status === 'Complete' ||
    (t.status === 'Evaluating' && (t.currentRevision ?? REV0) !== REV0));
function deriveWoStatus(tasks) {
    if (!tasks || tasks.length === 0) return 'Draft';
    const allAre = (s) => tasks.every(t => t.status === s);
    if (allAre('Cancelled')) return 'Cancelled';
    if (allAre('Draft')) return 'Draft';
    if (allAre('Complete')) return 'Complete';
    if (allAre('Rejected')) return 'Rejected';
    const live = tasks.filter(t => !isClosed(t));
    if (live.length === 0) return 'Complete';
    const liveHas = (s) => live.some(t => t.status === s);
    const liveAllAre = (s) => live.every(t => t.status === s);
    if (reachedCustomer(tasks)) {
        if (liveHas('Evaluating')) return 'customer_reject';
        if (liveAllAre('pending_delivery')) return 'pending_delivery';
    }
    if (liveAllAre('For Checking')) return 'For Checking';
    if (live.some(t => t.status === 'In Progress' || t.status === 'For Checking')) return 'In Progress';
    if (liveHas('Evaluating')) return 'Evaluating';
    if (liveHas('Rejected') && liveHas('Assigned')) return 'Partially Approved';
    if (liveAllAre('Assigned')) return 'Assigned';
    return 'Evaluating';
}

// Statuses the /dashboard cards drop from the in-scope set (Dashboard.tsx:1367)
const EXCLUDED = ['Draft', 'Cancelled', 'Evaluating'];
const CURRENT_YEAR = new Date().getFullYear();

async function main() {
    console.log('🔍 READ-ONLY audit — no writes. Scope: type in {PreHandover, AfterSale}\n');

    // Firestore 'in' supports up to 10 values — 2 here is fine.
    const woSnap = await db.collection('workOrders')
        .where('type', 'in', ['PreHandover', 'AfterSale']).get();

    const rows = [];
    const taskStatusDist = {}; // distinct TASK-level status values across all WOA/WOP tasks
    for (const woDoc of woSnap.docs) {
        const wo = woDoc.data();
        const storedStatus = wo.status ?? '(none)';

        // Gather every task across every category (same set recomputeWoStatus uses).
        const tasks = [];
        const catsSnap = await woDoc.ref.collection('categories').get();
        for (const cat of catsSnap.docs) {
            const tSnap = await cat.ref.collection('tasks').get();
            tSnap.forEach(d => tasks.push({ ...d.data(), id: d.id }));
        }
        tasks.forEach(t => { const s = t.status ?? '(none)'; taskStatusDist[s] = (taskStatusDist[s] || 0) + 1; });

        const computed = deriveWoStatus(tasks);
        const match = storedStatus === computed;
        const createdYear = wo.createdAt ? new Date(wo.createdAt).getFullYear() : null;
        // Would fixing the status change whether the card shows this WO?
        const cardVisibilityFlips = EXCLUDED.includes(storedStatus) !== EXCLUDED.includes(computed);

        rows.push({
            id: woDoc.id, type: wo.type, createdAt: wo.createdAt ?? null, createdYear,
            taskCount: tasks.length, stored: storedStatus, computed, match, cardVisibilityFlips,
        });
    }

    const mismatches = rows.filter(r => !r.match);
    const flips = mismatches.filter(r => r.cardVisibilityFlips);
    const flipsThisYear = flips.filter(r => r.createdYear === CURRENT_YEAR);

    // ---- report ----
    console.log(`Total WOA/WOP work orders : ${rows.length}`);
    console.log(`Status MATCHES (stored==computed) : ${rows.length - mismatches.length}`);
    console.log(`Status MISMATCH (stale stored)    : ${mismatches.length}`);
    console.log(`  ↳ of those, card visibility FLIPS: ${flips.length}  (created ${CURRENT_YEAR}: ${flipsThisYear.length})\n`);

    if (mismatches.length) {
        console.log('── MISMATCHES (stored → computed) ──────────────────────────────');
        for (const r of mismatches) {
            const flip = r.cardVisibilityFlips
                ? (EXCLUDED.includes(r.stored) ? '  ⚠️ HIDDEN-but-should-SHOW' : '  ⚠️ SHOWN-but-should-HIDE')
                : '';
            console.log(`${r.id}  [${r.type}]  y${r.createdYear ?? '?'}  tasks:${r.taskCount}  ${r.stored} → ${r.computed}${flip}`);
        }
        console.log('');
    }

    // stored-status distribution (context: how many are excluded right now)
    const dist = {};
    for (const r of rows) dist[r.stored] = (dist[r.stored] || 0) + 1;
    console.log('── WO stored status distribution ──');
    Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`  ${s}: ${n}`));

    // TASK-level status distribution — flags legacy values deriveWoStatus can't map.
    const VALID_TASK = ['Draft', 'Evaluating', 'Assigned', 'In Progress', 'For Checking', 'pending_delivery', 'Complete', 'Rejected', 'Cancelled'];
    console.log('\n── TASK status distribution (⚠️ = legacy, not in current TaskStatus enum) ──');
    Object.entries(taskStatusDist).sort((a, b) => b[1] - a[1]).forEach(([s, n]) =>
        console.log(`  ${s}: ${n}${VALID_TASK.includes(s) ? '' : '   ⚠️ LEGACY'}`));

    const outPath = resolve(__dirname, '../wo-status-audit-report.json');
    writeFileSync(outPath, JSON.stringify({
        generatedAt: new Date().toISOString(), currentYear: CURRENT_YEAR,
        totals: { all: rows.length, matched: rows.length - mismatches.length, mismatched: mismatches.length, cardFlips: flips.length, cardFlipsThisYear: flipsThisYear.length },
        mismatches, allRows: rows,
    }, null, 2), 'utf8');
    console.log(`\n📄 Full detail written to ${outPath}`);
}

main().catch(e => { console.error('audit failed:', e); process.exit(1); });
