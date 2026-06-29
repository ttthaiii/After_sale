/**
 * One-time migration: move existing PreHandover phDailyReports (flat path)
 * into phRevisions/rev00/phDailyReports (revision path).
 *
 * OLD: workOrders/{woId}/categories/{catId}/phDailyReports/{date}
 * NEW: workOrders/{woId}/categories/{catId}/revisions/rev00/dailyReports/{date}
 *
 * Also moves phDailyReportsDraft → revisions/rev00/dailyReportsDraft if exists.
 * Sets currentRevision: 'rev00' on category if not already set.
 * Creates revisions/rev00 doc if not exists.
 *
 * Run: node scripts/migrate-ph-revisions.mjs
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account JSON
 *           OR set PROJECT_ID below and use Application Default Credentials.
 */

import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────
const PROJECT_ID = 'after-sale-system';
// Put your service account JSON file path here (relative to this script):
const SERVICE_ACCOUNT_PATH = resolve(__dirname, '../serviceAccount.json');
// ────────────────────────────────────────────────────────────────────────────

let app;
try {
  app = getApp();
} catch {
  try {
    const sa = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    app = initializeApp({ credential: cert(sa), projectId: PROJECT_ID });
    console.log('✅ Initialized with service account');
  } catch {
    // Fallback: Application Default Credentials (gcloud auth application-default login)
    app = initializeApp({ projectId: PROJECT_ID });
    console.log('✅ Initialized with Application Default Credentials');
  }
}

const db = getFirestore(app);

async function migrateCategory(woId, catRef, catData, dryRun) {
  const catId = catRef.id;

  // Skip if already migrated (either old field name or new field name)
  if (catData.currentRevision || catData.currentPhRevision) {
    const rev = catData.currentRevision || catData.currentPhRevision;
    console.log(`  [SKIP] ${catId} — already migrated, currentRevision: ${rev}`);
    return { skipped: true };
  }

  // Check if old phDailyReports exist (old Firestore collection names before rename)
  const oldReportsRef = catRef.collection('phDailyReports');
  const oldDraftRef   = catRef.collection('phDailyReportsDraft');

  const [reportsSnap, draftSnap] = await Promise.all([
    oldReportsRef.get(),
    oldDraftRef.get(),
  ]);

  const reportCount = reportsSnap.size;
  const draftCount  = draftSnap.size;

  if (reportCount === 0 && draftCount === 0) {
    console.log(`  [SKIP] ${catId} — no phDailyReports to migrate, but setting rev00`);
  } else {
    console.log(`  [MIGRATE] ${catId} — ${reportCount} reports, ${draftCount} drafts → revisions/rev00`);
  }

  if (dryRun) {
    return { migrated: true, reportCount, draftCount, dryRun: true };
  }

  const batch = db.batch();

  // 1. Create revisions/rev00 doc
  const rev00Ref = catRef.collection('revisions').doc('rev00');
  batch.set(rev00Ref, {
    revisionId: 'rev00',
    status: 'active',
    createdAt: new Date().toISOString(),
    migratedAt: new Date().toISOString(),
  }, { merge: true });

  // 2. Copy phDailyReports → revisions/rev00/dailyReports
  for (const doc of reportsSnap.docs) {
    const destRef = rev00Ref.collection('dailyReports').doc(doc.id);
    batch.set(destRef, doc.data());
  }

  // 3. Copy phDailyReportsDraft → revisions/rev00/dailyReportsDraft
  for (const doc of draftSnap.docs) {
    const destRef = rev00Ref.collection('dailyReportsDraft').doc(doc.id);
    batch.set(destRef, doc.data());
  }

  // 4. Set currentRevision on category
  batch.update(catRef, { currentRevision: 'rev00' });

  await batch.commit();

  // 5. Delete old flat collections (must be done after commit, one-by-one)
  const deleteBatch = db.batch();
  for (const doc of reportsSnap.docs) {
    deleteBatch.delete(oldReportsRef.doc(doc.id));
  }
  for (const doc of draftSnap.docs) {
    deleteBatch.delete(oldDraftRef.doc(doc.id));
  }
  if (reportsSnap.size > 0 || draftSnap.size > 0) {
    await deleteBatch.commit();
    console.log(`    ✅ Moved + deleted old flat docs`);
  }

  return { migrated: true, reportCount, draftCount };
}

async function run(dryRun = false) {
  if (dryRun) console.log('\n🔍 DRY RUN — no writes will happen\n');
  else        console.log('\n🚀 LIVE RUN — writing to Firestore\n');

  const wosSnap = await db.collection('workOrders')
    .where('type', '==', 'PreHandover')
    .get();

  console.log(`Found ${wosSnap.size} PreHandover WO(s)\n`);

  let totalMigrated = 0;
  let totalSkipped  = 0;

  for (const woDoc of wosSnap.docs) {
    const woId   = woDoc.id;
    const woData = woDoc.data();
    console.log(`\n📋 WO: ${woId} — ${woData.projectName || ''} (status: ${woData.status})`);

    const catsSnap = await db.collection('workOrders').doc(woId).collection('categories').get();
    console.log(`   Categories: ${catsSnap.size}`);

    for (const catDoc of catsSnap.docs) {
      const result = await migrateCategory(
        woId,
        catDoc.ref,
        catDoc.data(),
        dryRun
      );
      if (result.skipped) totalSkipped++;
      else totalMigrated++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Migrated: ${totalMigrated} categories`);
  console.log(`⏭  Skipped:  ${totalSkipped} categories`);
  if (dryRun) console.log('\n⚠️  Dry run complete — run with LIVE=true to apply');
}

// Entry point
const isLive = process.argv.includes('--live');
run(!isLive).catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
