// audit-sla-cases.mjs — READ-ONLY. No writes.
// Answers: of the tasks feeding the two SLA cards (healthCardProjects, Dashboard.tsx:1877-1935),
//   - how many total / on-time (deviation>=0) / late (verify the 6 vs 4)
//   - how many are LEGACY status vs CURRENT status
//   - how each matched the completion gate: dailyProgress===100 vs status==='Complete'
//   - RISK CHECK: any task with status==='Complete' BUT dailyProgress!==100 (would be dropped if we cut ||Complete)
// Scope (user constraint): ONLY type in {PreHandover, AfterSale}. Period: year 2026 (dashboard shows ปี 2026).
// Run: node scripts/audit-sla-cases.mjs

import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../key/after-sale-key.json'), 'utf8'));
let app; try { app = getApp(); } catch { app = initializeApp({ credential: cert(sa), projectId: 'after-sale-system' }); }
const db = getFirestore(app);

const slaHoursMap = { 'Immediately': 4, '24h': 24, '1-3d': 72, '3-7d': 168, '7-14d': 336, '14-30d': 720 };
const CURRENT = ['Draft','Evaluating','Assigned','In Progress','For Checking','pending_delivery','Complete','Rejected','Cancelled'];
const now = Date.now();
const startOfYear = new Date(2026, 0, 1).getTime();
const endOfYear = new Date(2026, 11, 31, 23, 59, 59, 999).getTime();

async function main() {
  const woSnap = await db.collection('workOrders').where('type', 'in', ['PreHandover', 'AfterSale']).get();
  const cases = [];

  for (const woDoc of woSnap.docs) {
    const wo = woDoc.data();
    const created = new Date(wo.createdAt).getTime();
    if (!(created >= startOfYear && created <= endOfYear)) continue;
    if (!wo.projectId) continue;
    const woSlaStart = wo.createdAt ? created : now;
    const catsSnap = await woDoc.ref.collection('categories').get();
    for (const cat of catsSnap.docs) {
      const tSnap = await cat.ref.collection('tasks').get();
      for (const td of tSnap.docs) {
        const t = td.data();
        const prog = t.dailyProgress;
        const isCompleted = prog === 100 || t.status === 'Complete';
        if (!isCompleted) continue;

        const limit = slaHoursMap[t.slaCategory || '24h'] || 24;
        const start = t.startDate
          ? new Date(`${String(t.startDate).split('T')[0]}T08:00:00`).getTime()
          : (t.slaStartTime ? new Date(t.slaStartTime).getTime() : woSlaStart);
        const history = [...(t.history || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const last = history[history.length - 1];
        const end = last ? new Date(last.date).getTime() : now;
        const workHours = history.reduce((acc, h) => {
          let hTotal = 0;
          (h.labor || []).forEach(lab => {
            const hrs = lab.shifts
              ? (lab.shifts.normal ? 8 : 0) + (lab.shifts.otMorning ? 2 : 0) + (lab.shifts.otNoon ? 1 : 0) + (lab.shifts.otEvening ? 3 : 0)
              : (lab.timeType === 'Normal' ? 8 : 2);
            hTotal += hrs * (lab.amount || 1);
          });
          return acc + hTotal;
        }, 0);
        const calendarHours = (end - start) / 3600000;
        const duration = Math.max(calendarHours, workHours);
        const deviation = 100 - (duration / limit * 100);

        cases.push({
          wo: woDoc.id, status: t.status ?? '(none)', prog: prog ?? '(none)',
          matchedBy: (prog === 100 && t.status === 'Complete') ? 'both'
                   : (prog === 100 ? 'progress100' : 'completeOnly'),
          legacy: !CURRENT.includes(t.status),
          onTime: deviation >= 0, deviation: Math.round(deviation),
        });
      }
    }
  }

  const onTime = cases.filter(c => c.onTime).length;
  const late = cases.length - onTime;
  console.log('=== SLA CARD CASES (WOA/WOP, created 2026, gate = progress===100 || status===Complete) ===\n');
  console.log(`total cases     : ${cases.length}`);
  console.log(`เสร็จทัน (dev>=0): ${onTime}`);
  console.log(`เลย SLA (dev<0)  : ${late}`);

  const byStatus = {};
  cases.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });
  console.log(`\n-- by task status (legacy?) --`);
  Object.entries(byStatus).sort((a,b)=>b[1]-a[1]).forEach(([s,n]) => {
    const lg = !CURRENT.includes(s) ? 'LEGACY' : 'current';
    console.log(`   ${s} : ${n}   [${lg}]`);
  });

  const byMatch = {};
  cases.forEach(c => { byMatch[c.matchedBy] = (byMatch[c.matchedBy] || 0) + 1; });
  console.log(`\n-- matched completion gate via --`);
  Object.entries(byMatch).forEach(([m,n]) => console.log(`   ${m} : ${n}`));

  const risk = cases.filter(c => c.matchedBy === 'completeOnly');
  console.log(`\n-- RISK: status===Complete BUT dailyProgress!==100 (dropped if we cut ||Complete) : ${risk.length} --`);
  risk.forEach(c => console.log(`   ${c.wo}  status=${c.status}  prog=${c.prog}`));

  const legacyCount = cases.filter(c => c.legacy).length;
  console.log(`\n>> legacy-status cases: ${legacyCount} / ${cases.length}  (these inflate the card via old data)`);
}

main().catch(e => { console.error('failed:', e); process.exit(1); });
