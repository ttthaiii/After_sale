// T-craft (2026-07-24) — realtime visibility into foreman drafts for Admin/Manager.
//
// A foreman's in-progress daily report is saved as a draft doc under the task
// tree (see DailyReportContext.tsx's handleSaveDraft/savePhDraft) BEFORE it's
// submitted — the real dailyReports/history entry only appears once the
// foreman actually submits. Until now nothing subscribed to these draft
// collections, so Admin had zero visibility into in-progress work during the
// day. This hook adds that listener, mirroring useRealtimeWorkOrders'
// collectionGroup pattern, but only for the 2 draft collections and always
// unfiltered — this is an Admin-only view, so the project-scoping used for
// foreman-facing data doesn't apply here.
//
// Draft docs don't store their own workOrderId/taskId in the payload — same
// as every other level in this app, the ids are read off the Firestore path.

import { useEffect, useRef, useState } from 'react';
import { collectionGroup, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface DraftReportEntry {
  taskId: string;
  reportDate: string;
  progress: number;
  note: string;
  sitePhotos: string[];
  updatedAt: string;
  updatedBy: string;
  isHelper: boolean;
}

/** Both draft collection names in use — WOA (regular + helper) and WOP. */
const DRAFT_GROUPS = ['dailyReportsDraft', 'dailyreportDraft'];

/**
 * `workOrders/{woId}/categories/{catId}/tasks/{taskId}/...` — for a regular
 * (non-helper) draft, `taskId` (index 5) is the id the assembled MasterTask
 * renders under (assembleWorkOrders.ts pushes `id: taskDoc.id`).
 *
 * A HELPER draft sits one level deeper — `.../tasks/{taskId}/subtasks/{subId}
 * /help/{helpId}/dailyReportsDraft/{date}` — and the helper's virtual
 * MasterTask entry is pushed with `id: subtaskDoc.id` (index 7), NOT the
 * parent taskId, so it needs its own path index to match correctly.
 */
function taskIdFromPath(path: string): string | null {
  const parts = path.split('/');
  if (parts.includes('help')) {
    return parts.length > 7 ? parts[7] : null;
  }
  return parts.length > 5 ? parts[5] : null;
}

/** Map of taskId -> its most recently updated pending draft (across every
 *  pending draft date for that task). Empty map while `enabled` is false. */
export function useDraftReports(enabled: boolean): Map<string, DraftReportEntry> {
  // Internal: one entry per (taskId, reportDate) so add/remove from
  // docChanges stays correct even when a task has drafts on more than one
  // pending date at once.
  const rawRef = useRef<Map<string, DraftReportEntry>>(new Map());
  const [byTask, setByTask] = useState<Map<string, DraftReportEntry>>(new Map());

  useEffect(() => {
    if (!enabled) {
      rawRef.current = new Map();
      setByTask(new Map());
      return;
    }

    const recompute = () => {
      const latest = new Map<string, DraftReportEntry>();
      rawRef.current.forEach((entry) => {
        const existing = latest.get(entry.taskId);
        if (!existing || entry.reportDate > existing.reportDate) {
          latest.set(entry.taskId, entry);
        }
      });
      setByTask(latest);
    };

    const unsubscribes = DRAFT_GROUPS.map((group) =>
      onSnapshot(
        collectionGroup(db, group),
        (snapshot) => {
          for (const change of snapshot.docChanges()) {
            const path = change.doc.ref.path;
            if (!path.startsWith('workOrders/')) continue;
            const taskId = taskIdFromPath(path);
            if (!taskId) continue;
            const key = `${taskId}|${change.doc.id}`;

            if (change.type === 'removed') {
              rawRef.current.delete(key);
            } else {
              const data = change.doc.data() as any;
              rawRef.current.set(key, {
                taskId,
                reportDate: change.doc.id,
                progress: data.progress ?? 0,
                note: data.note || '',
                sitePhotos: (data.sitePhotos || []).filter(Boolean),
                updatedAt: data.updatedAt || '',
                updatedBy: data.updatedBy || '',
                isHelper: path.includes('/help/'),
              });
            }
          }
          recompute();
        },
        (err) => console.error(`[useDraftReports] ${group} listener error:`, err)
      )
    );

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [enabled]);

  return byTask;
}
