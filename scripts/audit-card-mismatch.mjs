// audit-card-mismatch.mjs — READ-ONLY. No writes.
// Explains why the /dashboard "ใบงาน" (WO) count > "รายการย่อย" (subtask) count.
// Replicates getDashboardStats gates (Dashboard.tsx:1370-1433) against real data:
//   WO in scope  = NOT (Draft|Cancelled | (Evaluating & no approved task))
//   subtask count= tasks whose status is in APPROVED_TASK_STATUSES, within in-scope WOs
// NOTE: skips the dashboard's month/owner filter, so absolute numbers won't equal 27/16 exactly —
// the point is the MECHANISM: how many in-scope WOs carry 0 approved-status tasks (legacy statuses).
// Scope (user constraint): ONLY type in {PreHandover, AfterSale}.
// Run: node scripts/audit-card-mismatch.mjs

import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../key/after-sale-key.json'), 'utf8'));
let app; try { app = getApp(); } catch { app = initializeApp({ credential: cert(sa), projectId: 'after-sale-system' }); }
const db = getFirestore(app);

const APPROVED = ['Assigned', 'In Progress', 'For Checking', 'pending_delivery', 'Complete'];
const hasApproved = tasks => tasks.some(t => APPROVED.includes(t.status));
const isOutOfScope = (woStatus, tasks) =>
  woStatus === 'Draft' || woStatus === 'Cancelled' || (woStatus === 'Evaluating' && !hasApproved(tasks));

async function main() {
  const woSnap = await db.collection('workOrders').where('type', 'in', ['PreHandover', 'AfterSale']).get();

  let inScopeWO = 0, approvedTasks = 0;
  const taskStatusDist = {}, woStatusDist = {};
  const culprits = []; // in-scope WOs with 0 approved tasks

  for (const woDoc of woSnap.docs) {
    const wo = woDoc.data();
    const catsSnap = await woDoc.ref.collection('categories').get();
    const tasks = [];
    for (const cat of catsSnap.docs) {
      const tSnap = await cat.ref.collection('tasks').get();
      tSnap.docs.forEach(d => tasks.push({ status: d.data().status ?? '(none)' }));
    }
    tasks.forEach(t => { taskStatusDist[t.status] = (taskStatusDist[t.status] || 0) + 1; });

    if (isOutOfScope(wo.status, tasks)) continue;
    inScopeWO++;
    woStatusDist[wo.status ?? '(none)'] = (woStatusDist[wo.status ?? '(none)'] || 0) + 1;
    const approvedHere = tasks.filter(t => APPROVED.includes(t.status)).length;
    approvedTasks += approvedHere;
    if (approvedHere === 0) {
      const statuses = [...new Set(tasks.map(t => t.status))];
      culprits.push({ id: woDoc.id, woStatus: wo.status, taskCount: tasks.length, taskStatuses: statuses });
    }
  }

  console.log('=== DASHBOARD CARD MISMATCH (WOA/WOP, no month/owner filter) ===\n');
  console.log(`in-scope WOs (ใบงาน gate)      : ${inScopeWO}`);
  console.log(`approved tasks (รายการย่อย gate): ${approvedTasks}`);
  console.log(`\n-- in-scope WO status distribution --`);
  Object.entries(woStatusDist).sort((a,b)=>b[1]-a[1]).forEach(([s,n]) => console.log(`   ${s} : ${n}`));
  console.log(`\n-- ALL task status distribution (shows legacy vocab) --`);
  Object.entries(taskStatusDist).sort((a,b)=>b[1]-a[1]).forEach(([s,n]) => {
    const counts = APPROVED.includes(s) ? 'COUNTS' : 'not counted';
    console.log(`   ${s} : ${n}   [${counts}]`);
  });
  console.log(`\n-- CULPRIT WOs: in scope but 0 approved tasks (inflate ใบงาน, add 0 รายการย่อย) : ${culprits.length} --`);
  culprits.slice(0, 20).forEach(c =>
    console.log(`   ${c.id}  wo.status=${c.woStatus}  tasks=${c.taskCount}  statuses=[${c.taskStatuses.join(', ')}]`));
  if (culprits.length > 20) console.log(`   ... +${culprits.length - 20} more`);
}

main().catch(e => { console.error('failed:', e); process.exit(1); });
