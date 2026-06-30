/**
 * migrate-wop-documents-to-task.mjs
 *
 * Moves `documents` field from WOP work order root doc
 * → first category's task doc (taskId = catId)
 *
 * Usage:
 *   node scripts/migrate-wop-documents-to-task.mjs           (dry-run)
 *   node scripts/migrate-wop-documents-to-task.mjs --apply   (write to Firestore)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccount.json');

const APPLY = process.argv.includes('--apply');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
    console.log(`Mode: ${APPLY ? 'APPLY (writing to Firestore)' : 'DRY-RUN (no writes)'}\n`);

    const woSnap = await db.collection('workOrders')
        .where('workOrderCode', '==', 'WOP')
        .get();

    console.log(`Found ${woSnap.size} WOP workOrders\n`);

    let migrated = 0;
    let skipped = 0;

    for (const woDoc of woSnap.docs) {
        const woData = woDoc.data();
        const woId = woDoc.id;
        const documents = woData.documents;

        if (!documents || documents.length === 0) {
            console.log(`  [${woId}] no documents at WO root → skip`);
            skipped++;
            continue;
        }

        // Find first category (sorted alphabetically — same as fetchSubcollections)
        const catsSnap = await db.collection('workOrders').doc(woId).collection('categories').get();
        if (catsSnap.empty) {
            console.log(`  [${woId}] no categories → skip`);
            skipped++;
            continue;
        }

        const sortedCats = [...catsSnap.docs].sort((a, b) => a.id.localeCompare(b.id));
        const firstCat = sortedCats[0];
        const taskId = firstCat.id; // WOP: taskId === catId

        const taskRef = db
            .collection('workOrders').doc(woId)
            .collection('categories').doc(firstCat.id)
            .collection('tasks').doc(taskId);

        const taskSnap = await taskRef.get();

        console.log(`  [${woId}] documents: ${documents.length} file(s)`);
        console.log(`    → target: categories/${firstCat.id}/tasks/${taskId}`);
        console.log(`    task exists: ${taskSnap.exists}`);

        if (APPLY) {
            if (taskSnap.exists) {
                await taskRef.update({ documents });
            } else {
                // Task not yet created (WOP not approved yet) — store on category instead
                await firstCat.ref.update({ documents });
                console.log(`    task not found → stored on category doc instead`);
            }
            // Remove from WO root
            await woDoc.ref.update({ documents: FieldValue.delete() });
            console.log(`    ✓ migrated + removed from WO root`);
            migrated++;
        }
    }

    console.log(`\n─────────────────────────────────`);
    console.log(`Migrated : ${migrated}`);
    console.log(`Skipped  : ${skipped}`);
    if (!APPLY) console.log(`\nRun with --apply to execute migration`);
}

run().catch(err => { console.error(err); process.exit(1); });
