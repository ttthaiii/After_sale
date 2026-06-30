/**
 * migrate-wop-structure.mjs
 *
 * Restructures WOP (PreHandover) Firestore data to match WOA (AfterSale) path structure.
 *
 * ─── BEFORE (WOP current) ────────────────────────────────────────────────────
 * workOrders/{woId}
 *   └── categories/{catId}                       ← fields: assignedForemanId, currentRevision, dailyProgress, name, status
 *         └── revisions/{rev}                    ← fields: revisionId, status, createdAt
 *               ├── dailyReports/{date}
 *               └── dailyReportsDraft/{date}
 *
 * ─── AFTER (WOA-matching) ────────────────────────────────────────────────────
 * workOrders/{woId}
 *   └── categories/{catId}
 *         └── tasks/{taskId}                     ← taskId = catId (1 dummy task per category)
 *               │     fields: taskId, taskName, assignees, status, workOrderId,
 *               │             workOrderCode, workOrderName, categoryId, categoryName,
 *               │             projectId, isActive, isPreHandover: true
 *               └── subtasks/{subtaskId}         ← subtaskId = strip leading jobCode prefix from catId
 *                     │     fields: subtaskId, subtaskName, status, dailyProgress,
 *                     │             assignees, currentRevision, isActive
 *                     └── revisions/{rev}        ← fields: revisionId, revisionName, status, createdAt
 *                           ├── dailyReports/{date}
 *                           └── dailyReportsDraft/{date}
 *
 * ─── subtaskId formula (matches WOA getSubtaskId) ───────────────────────────
 *   Strip leading 2–4 uppercase-letter segment + dash if followed by 3-letter segment:
 *   ART-WOP-0005-0001  →  WOP-0005-0001
 *
 * ─── Safety ─────────────────────────────────────────────────────────────────
 *   • Only touches workOrders where type == 'PreHandover'  ← NEVER touches WOA
 *   • Dry run by default — use --live to write
 *   • Old revisions/{rev} data is NOT deleted — use --cleanup to delete after verify
 *
 * Run:
 *   node scripts/migrate-wop-structure.mjs            ← dry run
 *   node scripts/migrate-wop-structure.mjs --live     ← write to Firestore
 *   node scripts/migrate-wop-structure.mjs --live --cleanup  ← write + delete old paths
 */

import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH = resolve(__dirname, '../serviceAccount.json');
const PROJECT_ID = 'after-sale-system';

// ── Init ─────────────────────────────────────────────────────────────────────
let app;
try { app = getApp(); } catch {
  try {
    const sa = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    app = initializeApp({ credential: cert(sa), projectId: PROJECT_ID });
    console.log('✅ Service account loaded\n');
  } catch {
    app = initializeApp({ projectId: PROJECT_ID });
    console.log('✅ Application Default Credentials\n');
  }
}
const db = getFirestore(app);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Matches WOA getSubtaskId: strip leading job-code prefix (2–4 uppercase + dash) if followed by 3-letter segment */
function getSubtaskId(taskId) {
  if (taskId) return taskId.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
  return taskId;
}

/** Delete every doc in a subcollection (Firestore doesn't auto-delete subcollections) */
async function deleteCollection(collRef) {
  const snap = await collRef.get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

/**
 * Collect all (revisionId, dailyReports[], drafts[]) across all historical paths:
 *   Path A (current):    revisions/{rev}/dailyReports + dailyReportsDraft
 *   Path B (intermediate): phRevisions/{rev}/phDailyReports + phDailyReportsDraft   ← written between first and second rename
 *   Path C (old flat):   phDailyReports + phDailyReportsDraft                       ← written before revision layer
 */
async function collectAllRevisions(catRef) {
  const revMap = {}; // revId → { reports: [], drafts[] }

  // Helper to add docs to revMap
  const add = (revId, field, docs) => {
    if (!revMap[revId]) revMap[revId] = { reports: [], drafts: [] };
    revMap[revId][field].push(...docs);
  };

  // Path A: revisions/{rev}/dailyReports  +  dailyReportsDraft
  const revASnap = await catRef.collection('revisions').get();
  for (const revDoc of revASnap.docs) {
    const rSnap = await revDoc.ref.collection('dailyReports').get();
    const dSnap = await revDoc.ref.collection('dailyReportsDraft').get();
    add(revDoc.id, 'reports', rSnap.docs);
    add(revDoc.id, 'drafts',  dSnap.docs);
  }

  // Path B: phRevisions/{rev}/phDailyReports + phDailyReportsDraft
  // NOTE: the phRevisions/{rev} doc itself may not exist (Firestore orphan subcollection)
  // So we probe known revIds via collectionGroup-style approach
  const phRevIds = ['rev00', 'rev01', 'rev02', 'rev03'];
  for (const revId of phRevIds) {
    const phRevRef = catRef.collection('phRevisions').doc(revId);
    const rSnap = await phRevRef.collection('phDailyReports').get();
    const dSnap = await phRevRef.collection('phDailyReportsDraft').get();
    if (rSnap.size > 0 || dSnap.size > 0) {
      add(revId, 'reports', rSnap.docs);
      add(revId, 'drafts',  dSnap.docs);
    }
  }

  // Path C: flat phDailyReports + phDailyReportsDraft (very old)
  const flatR = await catRef.collection('phDailyReports').get();
  const flatD = await catRef.collection('phDailyReportsDraft').get();
  if (flatR.size > 0 || flatD.size > 0) {
    add('rev00', 'reports', flatR.docs);
    add('rev00', 'drafts',  flatD.docs);
  }

  return revMap;
}

// ── Core migration per category ───────────────────────────────────────────────
async function migrateCategory(woId, woData, catRef, catData, dryRun, cleanup) {
  const catId    = catRef.id;
  const taskId   = catId;
  const subtaskId = getSubtaskId(catId);

  // Check if already migrated with correct assignees format (employeeId field)
  const existingTasksSnap = await catRef.collection('tasks').get();
  if (!existingTasksSnap.empty) {
    const taskDoc = existingTasksSnap.docs[0];
    const firstAssignee = taskDoc.data()?.assignees?.[0];
    // If already using correct WOA format (employeeId field), skip
    if (firstAssignee && 'employeeId' in firstAssignee) {
      console.log(`  [SKIP] ${catId} — tasks layer already exists with correct assignees format`);
      return { skipped: true };
    }
    // Wrong format (old {id, role} format) — delete and re-migrate
    console.log(`  [REMIGRATE] ${catId} — tasks layer exists but assignees format is wrong, deleting...`);
    if (!dryRun) {
      const subSnap = await taskDoc.ref.collection('subtasks').get();
      for (const subDoc of subSnap.docs) {
        const revsSnap = await subDoc.ref.collection('revisions').get();
        for (const revDoc of revsSnap.docs) {
          await deleteCollection(revDoc.ref.collection('dailyReports'));
          await deleteCollection(revDoc.ref.collection('dailyReportsDraft'));
          await revDoc.ref.delete();
        }
        await subDoc.ref.delete();
      }
      await taskDoc.ref.delete();
    }
  }

  // ── Collect all historical data ──────────────────────────────────────────
  const revMap = await collectAllRevisions(catRef);
  const revIds = Object.keys(revMap);

  // ── Report what will happen ──────────────────────────────────────────────
  console.log(`\n  [MIGRATE] ${catId}`);
  console.log(`    taskId    : ${taskId}`);
  console.log(`    subtaskId : ${subtaskId}`);
  if (revIds.length === 0) {
    console.log(`    revisions : (none — will create empty rev00)`);
  }
  for (const revId of revIds) {
    console.log(`    ${revId}: ${revMap[revId].reports.length} dailyReports, ${revMap[revId].drafts.length} drafts`);
  }

  const totalReports = revIds.reduce((sum, id) => sum + revMap[id].reports.length, 0);
  if (dryRun) return { migrated: true, taskId, subtaskId, totalReports, dryRun: true };

  // ── Build assignees array (WOA-matching format: {employeeId, name, roleId}) ─
  const assignees = [];
  if (catData.assignedForemanId) {
    // Look up user doc to get actual roleId (matches resolveAssignees() output)
    let roleId = '';
    try {
      const userSnap = await db.doc(`users/${catData.assignedForemanId}`).get();
      roleId = userSnap.data()?.roleId || userSnap.data()?.role || '';
    } catch (_) {}
    assignees.push({
      employeeId: catData.assignedForemanId,
      name: catData.assignedForemanName || '',
      roleId,
    });
  }
  if (catData.helperForemanIds?.length) {
    for (const empId of catData.helperForemanIds) {
      let roleId = '';
      try {
        const userSnap = await db.doc(`users/${empId}`).get();
        roleId = userSnap.data()?.roleId || userSnap.data()?.role || '';
      } catch (_) {}
      assignees.push({ employeeId: empId, name: '', roleId });
    }
  }

  // ── Task doc (WOA-matching fields) ───────────────────────────────────────
  const taskDoc = {
    taskId,
    taskName:      catData.name || catData.catName || '',
    assignees,
    status:        catData.status || 'In Progress',
    workOrderId:   woId,
    workOrderCode: woData.workOrderCode || woData.code || woId,
    workOrderName: woData.locationName  || woData.projectName || '',
    categoryId:    catId,
    categoryName:  catData.name || catData.catName || '',
    projectId:     woData.projectId || '',
    isActive:      true,
    isPreHandover: true,   // marker — tells other systems this is a WOP dummy task
    createdAt:     new Date().toISOString(),
  };

  // ── Subtask doc (WOA-matching fields) ────────────────────────────────────
  const subtaskDoc = {
    subtaskId,
    subtaskName:     catData.name || catData.catName || '',
    status:          catData.status || 'In Progress',
    dailyProgress:   catData.dailyProgress || 0,
    assignees,
    currentRevision: catData.currentRevision || 'rev00',
    isActive:        true,
    createdAt:       new Date().toISOString(),
  };

  // ── Write task + subtask docs ────────────────────────────────────────────
  const taskRef    = catRef.collection('tasks').doc(taskId);
  const subtaskRef = taskRef.collection('subtasks').doc(subtaskId);

  const currentRev = catData.currentRevision || catData.currentPhRevision || 'rev00';

  const batch0 = db.batch();
  batch0.set(taskRef, taskDoc);
  batch0.set(subtaskRef, { ...subtaskDoc, currentRevision: currentRev });
  await batch0.commit();
  console.log(`    ✅ task + subtask docs created`);

  // ── Copy all revisions + dailyReports + drafts ───────────────────────────
  const allRevIds = revIds.length > 0 ? revIds : ['rev00'];  // always ensure at least rev00
  for (const revId of allRevIds) {
    const newRevRef = subtaskRef.collection('revisions').doc(revId);
    const reports   = revMap[revId]?.reports || [];
    const drafts    = revMap[revId]?.drafts  || [];

    const revisionDoc = {
      revisionId:   revId,
      revisionName: revId === 'rev00' ? 'Initial Revision' : `Revision ${revId}`,
      status:       revId === currentRev ? 'active' : 'closed',
      createdAt:    new Date().toISOString(),
      migratedAt:   new Date().toISOString(),
    };

    const batchRev = db.batch();
    batchRev.set(newRevRef, revisionDoc, { merge: true });
    reports.forEach(d => batchRev.set(newRevRef.collection('dailyReports').doc(d.id), d.data()));
    drafts.forEach(d  => batchRev.set(newRevRef.collection('dailyReportsDraft').doc(d.id), d.data()));
    await batchRev.commit();
    console.log(`    ✅ ${revId}: ${reports.length} dailyReports, ${drafts.length} drafts copied`);
  }

  // ── Set currentRevision on category if missing ───────────────────────────
  if (!catData.currentRevision && !catData.currentPhRevision) {
    await catRef.update({ currentRevision: 'rev00' });
    console.log(`    ✅ set currentRevision: rev00 on category`);
  }

  // ── Cleanup old paths (only if --cleanup flag) ───────────────────────────
  if (cleanup) {
    let deleted = 0;
    // Delete revisions/{rev}/dailyReports
    const revASnap = await catRef.collection('revisions').get();
    for (const revDoc of revASnap.docs) {
      deleted += await deleteCollection(revDoc.ref.collection('dailyReports'));
      deleted += await deleteCollection(revDoc.ref.collection('dailyReportsDraft'));
      await revDoc.ref.delete(); deleted++;
    }
    // Delete phRevisions/{rev}/phDailyReports
    for (const revId of ['rev00', 'rev01', 'rev02', 'rev03']) {
      const phRevRef = catRef.collection('phRevisions').doc(revId);
      deleted += await deleteCollection(phRevRef.collection('phDailyReports'));
      deleted += await deleteCollection(phRevRef.collection('phDailyReportsDraft'));
      await phRevRef.delete(); // ok even if doesn't exist
    }
    // Delete flat
    deleted += await deleteCollection(catRef.collection('phDailyReports'));
    deleted += await deleteCollection(catRef.collection('phDailyReportsDraft'));
    if (deleted > 0) console.log(`    🗑  cleanup: ${deleted} old docs deleted`);
  }

  return { migrated: true, taskId, subtaskId, totalReports };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run(dryRun, cleanup) {
  if (dryRun)   console.log('🔍 DRY RUN — no writes\n');
  else if (cleanup) console.log('🚀 LIVE + CLEANUP — will write AND delete old paths\n');
  else          console.log('🚀 LIVE — writing to Firestore (old paths kept)\n');

  // SAFETY: only PreHandover WOs
  const wosSnap = await db.collection('workOrders')
    .where('type', '==', 'PreHandover')
    .get();

  console.log(`Found ${wosSnap.size} PreHandover WO(s)\n`);

  let totalMigrated = 0, totalSkipped = 0;

  for (const woDoc of wosSnap.docs) {
    const woId   = woDoc.id;
    const woData = woDoc.data();
    console.log(`📋 WO: ${woId} — ${woData.projectName || woData.locationName || ''} (status: ${woData.status})`);

    const catsSnap = await db.collection('workOrders').doc(woId).collection('categories').get();
    console.log(`   Categories: ${catsSnap.size}`);

    for (const catDoc of catsSnap.docs) {
      const result = await migrateCategory(woId, woData, catDoc.ref, catDoc.data(), dryRun, cleanup);
      if (result.skipped) totalSkipped++;
      else totalMigrated++;
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Migrated : ${totalMigrated} categories`);
  console.log(`⏭  Skipped  : ${totalSkipped} categories`);
  if (dryRun) console.log('\n⚠️  Dry run complete — run with --live to apply');
  if (!dryRun && !cleanup) console.log('\n💡 Old paths kept — run with --live --cleanup to remove after verifying');
}

const isLive    = process.argv.includes('--live');
const isCleanup = process.argv.includes('--cleanup');
run(!isLive, isCleanup && isLive).catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
