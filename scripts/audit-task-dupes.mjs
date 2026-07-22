// audit-task-dupes.mjs — READ-ONLY. Does NOT write to Firestore.
//
// Purpose (T-341): confirm the task-duplication bug. For each WOA/WOP work order,
// list every category doc id + its task doc ids (with taskName + status), and flag
// categories that contain duplicate task NAMES (the visible symptom) or task ids
// whose shape diverges — evidence that saveEvaluation writes recomputed ids while
// leaving the old ones behind.
//
// Scope (user constraint): ONLY type in {'PreHandover','AfterSale'}.
// Run:  node scripts/audit-task-dupes.mjs

import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../key/after-sale-key.json'), 'utf8'));
let app; try { app = getApp(); } catch { app = initializeApp({ credential: cert(sa), projectId: 'after-sale-system' }); }
const db = getFirestore(app);

async function main() {
    console.log('READ-ONLY task-dupe audit. Scope: type in {PreHandover, AfterSale}\n');
    const woSnap = await db.collection('workOrders')
        .where('type', 'in', ['PreHandover', 'AfterSale']).get();

    let flaggedWOs = 0;
    for (const woDoc of woSnap.docs) {
        const wo = woDoc.data();
        const catsSnap = await woDoc.ref.collection('categories').get();
        const catBlocks = [];
        let woHasDupe = false;

        for (const cat of catsSnap.docs) {
            const tSnap = await cat.ref.collection('tasks').get();
            const tasks = tSnap.docs.map(d => ({ id: d.id, name: d.data().taskName ?? d.data().name ?? '(no name)', status: d.data().status ?? '(none)' }));
            // duplicate task-NAME within one category = the visible symptom
            const nameCount = {};
            tasks.forEach(t => { nameCount[t.name] = (nameCount[t.name] || 0) + 1; });
            const dupeNames = Object.entries(nameCount).filter(([, n]) => n > 1);
            if (dupeNames.length) woHasDupe = true;
            catBlocks.push({ catDocId: cat.id, catName: cat.data().catName ?? cat.data().name ?? '', tasks, dupeNames });
        }

        if (woHasDupe) {
            flaggedWOs++;
            console.log(`\n=== WO ${woDoc.id}  [${wo.type}]  status:${wo.status ?? '(none)'}  createdAt:${wo.createdAt ?? '?'} ===`);
            for (const b of catBlocks) {
                console.log(`  category doc: ${b.catDocId}   name: "${b.catName}"`);
                for (const t of b.tasks) console.log(`     task ${t.id}   [${t.status}]   "${t.name}"`);
                if (b.dupeNames.length) console.log(`     >> DUPLICATE NAMES: ${b.dupeNames.map(([n, c]) => `"${n}" x${c}`).join(', ')}`);
            }
        }
    }
    console.log(`\nWOA/WOP work orders scanned: ${woSnap.size} · flagged with duplicate task names: ${flaggedWOs}`);
}

main().catch(e => { console.error('audit failed:', e); process.exit(1); });
