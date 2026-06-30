/**
 * fix-wop-dailyreport-fields.mjs
 *
 * Renames old WOP dailyReport field names to match WOA structure:
 *   noteType        → type
 *   sitePhotos      → photos.site
 *   laborPhotos.*   → photos.laborByShift.*
 *   submittedBy_id  → createdBy
 *   submittedAt     → createdAt
 *   (removes submittedBy string field)
 *   (adds id, revisionId, revisionName, status if missing)
 *
 * Safety: only touches WOP workOrders (type == 'PreHandover'), only
 *         dailyReports under tasks/{taskId}/subtasks/{subtaskId}/revisions path.
 *
 * Run:
 *   node scripts/fix-wop-dailyreport-fields.mjs            ← dry run
 *   node scripts/fix-wop-dailyreport-fields.mjs --live     ← apply
 */

import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../serviceAccount.json'), 'utf8'));
let app; try { app = getApp(); } catch { app = initializeApp({ credential: cert(sa), projectId: 'after-sale-system' }); }
const db = getFirestore(app);

const isLive = process.argv.includes('--live');

function transformDailyReport(data, docId, revId) {
  const d = { ...data };

  // Rename noteType → type
  if (d.noteType !== undefined && d.type === undefined) {
    d.type = d.noteType;
    delete d.noteType;
  }

  // Restructure photos
  if (d.sitePhotos !== undefined || d.laborPhotos !== undefined) {
    d.photos = {
      site: d.sitePhotos || d.photos?.site || [],
      laborByShift: {
        regular:   d.laborPhotos?.regular   || d.photos?.laborByShift?.regular   || [],
        otMorning: d.laborPhotos?.otMorning || d.photos?.laborByShift?.otMorning || [],
        otNoon:    d.laborPhotos?.otNoon    || d.photos?.laborByShift?.otNoon    || [],
        otEvening: d.laborPhotos?.otEvening || d.photos?.laborByShift?.otEvening || [],
      },
    };
    delete d.sitePhotos;
    delete d.laborPhotos;
  }

  // Rename submittedBy_id → createdBy
  if (d.submittedBy_id !== undefined && d.createdBy === undefined) {
    d.createdBy = d.submittedBy_id;
    delete d.submittedBy_id;
  }

  // Rename submittedAt → createdAt
  if (d.submittedAt !== undefined && d.createdAt === undefined) {
    d.createdAt = d.submittedAt;
    delete d.submittedAt;
  }

  // Remove submittedBy name string (replaced by createdBy ID)
  if (d.submittedBy !== undefined) delete d.submittedBy;

  // Add missing fields to match WOA structure
  if (!d.id)           d.id = docId;
  if (!d.revisionId)   d.revisionId = revId;
  if (!d.revisionName) d.revisionName = revId === 'rev00' ? 'Initial Revision' : `Revision ${revId}`;
  if (!d.status)       d.status = 'submitted';
  if (!d.updatedBy)    d.updatedBy = d.createdBy || '';
  if (!d.updatedAt)    d.updatedAt = d.createdAt || new Date().toISOString();

  return d;
}

async function run() {
  console.log(isLive ? '🚀 LIVE — applying field renames\n' : '🔍 DRY RUN\n');

  const wosSnap = await db.collection('workOrders').where('type', '==', 'PreHandover').get();
  console.log(`Found ${wosSnap.size} PreHandover WO(s)\n`);

  let totalFixed = 0, totalSkipped = 0;

  for (const woDoc of wosSnap.docs) {
    const woId = woDoc.id;
    console.log(`📋 WO: ${woId}`);
    const catsSnap = await db.collection('workOrders').doc(woId).collection('categories').get();
    for (const catDoc of catsSnap.docs) {
      const catId = catDoc.id;
      const tasksSnap = await catDoc.ref.collection('tasks').get();
      for (const taskDoc of tasksSnap.docs) {
        const subtasksSnap = await taskDoc.ref.collection('subtasks').get();
        for (const subDoc of subtasksSnap.docs) {
          const revsSnap = await subDoc.ref.collection('revisions').get();
          for (const revDoc of revsSnap.docs) {
            const drSnap = await revDoc.ref.collection('dailyReports').get();
            for (const drDoc of drSnap.docs) {
              const data = drDoc.data();
              // Check if needs transform (has any old field)
              const needsTransform = data.noteType !== undefined || data.sitePhotos !== undefined ||
                data.laborPhotos !== undefined || data.submittedBy_id !== undefined || data.submittedAt !== undefined;
              if (!needsTransform) { totalSkipped++; continue; }

              const transformed = transformDailyReport(data, drDoc.id, revDoc.id);
              console.log(`  [FIX] ${catId}/${taskDoc.id}/${subDoc.id}/${revDoc.id}/dailyReports/${drDoc.id}`);
              console.log(`        fields: ${Object.keys(data).join(', ')}`);
              console.log(`    →   fields: ${Object.keys(transformed).join(', ')}`);

              if (isLive) {
                await drDoc.ref.set(transformed);
                totalFixed++;
              } else {
                totalFixed++;
              }
            }
          }
        }
      }
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Fixed  : ${totalFixed} dailyReports`);
  console.log(`⏭  Skipped: ${totalSkipped} (already correct format)`);
  if (!isLive) console.log('\n⚠️  Dry run — run with --live to apply');
}

run().catch(err => { console.error('❌ Failed:', err); process.exit(1); });
