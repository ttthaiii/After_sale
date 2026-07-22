import type { MasterTask } from '../types';
import { deriveWoStatus } from './deriveWoStatus';

// Standalone test (no test runner installed). Compile + run:
//   npx tsc src/utils/deriveWoStatus.ts src/utils/deriveWoStatus.test.ts \
//     --outDir <tmp> --target es2020 --module es2020 --moduleResolution node --skipLibCheck
//   node <tmp>/deriveWoStatus.test.js
// (type-only import of MasterTask is erased → emitted JS has no runtime import of types)

type S = MasterTask['status'];
const t = (status: S, rev = 'rev00', taskArchived = false): MasterTask =>
    ({ id: 'x', name: 'x', dailyProgress: 0, status, currentRevision: rev, taskArchived } as MasterTask);

let pass = 0;
let fail = 0;
function expect(name: string, got: string, want: string) {
    if (got === want) { pass++; }
    else { fail++; console.error(`FAIL ${name}: got '${got}' want '${want}'`); }
}

// terminal all-same
expect('empty→Draft', deriveWoStatus([]), 'Draft');
expect('allDraft→Draft', deriveWoStatus([t('Draft'), t('Draft')]), 'Draft');
expect('allCancelled→Cancelled', deriveWoStatus([t('Cancelled'), t('Cancelled')]), 'Cancelled');
expect('allComplete→Complete', deriveWoStatus([t('Complete'), t('Complete')]), 'Complete');
expect('allRejected→Rejected', deriveWoStatus([t('Rejected'), t('Rejected')]), 'Rejected');

// admin-eval era
expect('allEvaluating→Evaluating', deriveWoStatus([t('Evaluating'), t('Evaluating')]), 'Evaluating');
expect('allAssigned→Assigned', deriveWoStatus([t('Assigned'), t('Assigned')]), 'Assigned');
expect('Assigned+liveRejected→Partially', deriveWoStatus([t('Assigned'), t('Rejected')]), 'Partially Approved');
expect('Assigned+Evaluating→Evaluating', deriveWoStatus([t('Assigned'), t('Evaluating')]), 'Evaluating');

// junction B — closed tasks excluded
expect('Assigned+RejectedArchived→Assigned', deriveWoStatus([t('Assigned'), t('Rejected', 'rev00', true)]), 'Assigned');

// junction A — work dominates pending eval
expect('InProgress+Evaluating(rev0)→InProgress', deriveWoStatus([t('In Progress'), t('Evaluating')]), 'In Progress');

// work era
expect('allForChecking→ForChecking', deriveWoStatus([t('For Checking'), t('For Checking')]), 'For Checking');
expect('ForChecking+Assigned→InProgress', deriveWoStatus([t('For Checking'), t('Assigned')]), 'In Progress');

// customer era
expect('allPendingDelivery→pending_delivery', deriveWoStatus([t('pending_delivery'), t('pending_delivery')]), 'pending_delivery');
expect('Complete+Evaluating(rev1)→customer_reject', deriveWoStatus([t('Complete'), t('Evaluating', 'rev01')]), 'customer_reject');
expect('allEvaluating(rev1)→customer_reject', deriveWoStatus([t('Evaluating', 'rev01'), t('Evaluating', 'rev01')]), 'customer_reject');

// rework loop resolution — admin re-assigned, passed siblings Complete
expect('Complete+Assigned(rev1)→Assigned', deriveWoStatus([t('Complete'), t('Assigned', 'rev01')]), 'Assigned');
expect('Complete+InProgress(rev1)→InProgress', deriveWoStatus([t('Complete'), t('In Progress', 'rev01')]), 'In Progress');

// rule 5 — only closed remain
expect('Complete+RejectedArchived→Complete', deriveWoStatus([t('Complete'), t('Rejected', 'rev00', true)]), 'Complete');
expect('allRejectedArchived(2)→Cancelled', deriveWoStatus([t('Rejected', 'rev00', true), t('Rejected', 'rev00', true)]), 'Cancelled');
expect('Cancelled+RejectedArchived→Cancelled', deriveWoStatus([t('Cancelled'), t('Rejected', 'rev00', true)]), 'Cancelled');

console.log(`deriveWoStatus tests: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
