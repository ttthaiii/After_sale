/**
 * cleanup-wop-category-fields.mjs
 *
 * Removes legacy fields from WOP category docs so the structure
 * matches WOA exactly (catId, catName, id, name, updatedAt only).
 *
 * Fields removed: assignedForemanId, assignedForemanName,
 *                 currentRevision, dailyProgress, lastProgressUpdate
 *
 * Usage:
 *   node scripts/cleanup-wop-category-fields.mjs           (dry-run)
 *   node scripts/cleanup-wop-category-fields.mjs --apply   (write to Firestore)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccount.json');

const APPLY = process.argv.includes('--apply');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const LEGACY_FIELDS = [
  'assignedForemanId',
  'assignedForemanName',
  'currentRevision',
  'dailyProgress',
  'lastProgressUpdate',
];

const REMOVE_MAP = Object.fromEntries(LEGACY_FIELDS.map(f => [f, FieldValue.delete()]));

async function run() {
  console.log(`Mode: ${APPLY ? 'APPLY (writing to Firestore)' : 'DRY-RUN (no writes)'}\n`);

  const woSnap = await db.collection('workOrders')
    .where('workOrderCode', '==', 'WOP')
    .get();

  console.log(`Found ${woSnap.size} WOP workOrders`);

  let totalCats = 0;
  let needsCleanup = 0;
  let cleaned = 0;

  for (const woDoc of woSnap.docs) {
    const woId = woDoc.id;
    const catSnap = await db.collection('workOrders').doc(woId).collection('categories').get();

    for (const catDoc of catSnap.docs) {
      totalCats++;
      const data = catDoc.data();
      const fieldsPresent = LEGACY_FIELDS.filter(f => f in data);

      if (fieldsPresent.length === 0) continue;

      needsCleanup++;
      console.log(`  [${woId}/${catDoc.id}] has: ${fieldsPresent.join(', ')}`);

      if (APPLY) {
        await catDoc.ref.update(REMOVE_MAP);
        cleaned++;
        console.log(`    → cleaned`);
      }
    }
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`Total categories : ${totalCats}`);
  console.log(`Needs cleanup    : ${needsCleanup}`);
  if (APPLY) {
    console.log(`Cleaned          : ${cleaned}`);
    console.log(`\nDone ✓`);
  } else {
    console.log(`\nRun with --apply to remove fields from ${needsCleanup} category docs`);
  }
}

run().catch(err => { console.error(err); process.exit(1); });
