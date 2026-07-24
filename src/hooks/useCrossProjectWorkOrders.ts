// T-craft (2026-07-23) — rare cross-project assignment fetch.
//
// Once WorkOrderContext's main listeners are scoped to a foreman's own
// assignedProjects (see useRealtimeWorkOrders), a foreman occasionally assigned
// to a single task OUTSIDE their home projects (as a helper, direct assignee, or
// the WO's reporter) would otherwise lose access to it entirely. Per the user
// (2026-07-23) this is rare/occasional, not routine — so unlike the main data
// path this is a deliberate ONE-TIME fetch, not a realtime listener: it runs
// once per login (and whenever `homeProjectIds` changes), not continuously.
// A newly-added cross-project assignment may take a page refresh to appear.
//
// Every `tasks` document already carries `projectId`, `responsibleStaffIds`,
// `helperForemanIds`, and `assignedForeman` (all pre-existing fields, some used
// for LB compatibility) — used here purely for discovery, not filtering cost.

import { useCallback, useEffect, useState } from 'react';
import { collection, collectionGroup, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WorkOrder } from '../types';
import { assembleWorkOrders } from '../utils/assembleWorkOrders';
import { createWorkOrderCache, upsertDoc, type WorkOrderCache } from '../store/workOrderCacheStore';

interface Identity {
  id: string;
  employeeId?: string;
}

/** One-time full-subtree read for a single WO id — the pre-T-335 pattern,
 *  intentionally reused here since this path is rare/small-volume by design. */
async function fetchWoSubtreeCache(woId: string): Promise<WorkOrderCache> {
  const cache = createWorkOrderCache();
  const catsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories'));
  for (const catDoc of catsSnap.docs) {
    upsertDoc(cache, 'categories', { id: catDoc.id, path: catDoc.ref.path, data: catDoc.data() });

    const tasksSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks'));
    for (const taskDoc of tasksSnap.docs) {
      upsertDoc(cache, 'tasks', { id: taskDoc.id, path: taskDoc.ref.path, data: taskDoc.data() });

      const subtasksSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks'));
      for (const subDoc of subtasksSnap.docs) {
        upsertDoc(cache, 'subtasks', { id: subDoc.id, path: subDoc.ref.path, data: subDoc.data() });

        const revsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subDoc.id, 'revisions'));
        for (const revDoc of revsSnap.docs) {
          upsertDoc(cache, 'revisions', { id: revDoc.id, path: revDoc.ref.path, data: revDoc.data() });
          const reportsSnap = await getDocs(collection(revDoc.ref, 'dailyReports'));
          for (const r of reportsSnap.docs) {
            upsertDoc(cache, 'revReports', { id: r.id, path: r.ref.path, data: r.data() });
          }
        }

        const helpSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subDoc.id, 'help'));
        for (const helpDoc of helpSnap.docs) {
          upsertDoc(cache, 'help', { id: helpDoc.id, path: helpDoc.ref.path, data: helpDoc.data() });
          const helpReportsSnap = await getDocs(collection(helpDoc.ref, 'dailyReports'));
          for (const hr of helpReportsSnap.docs) {
            upsertDoc(cache, 'helpReports', { id: hr.id, path: hr.ref.path, data: hr.data() });
          }
        }
      }
    }
  }
  return cache;
}

/** Distinct workOrderId values from a `tasks` collectionGroup query, excluding
 *  ones already covered by the user's home projects. */
async function discoverExtraWoIdsFromTasks(
  field: 'responsibleStaffIds' | 'helperForemanIds',
  identityValue: string,
  homeProjectIds: string[]
): Promise<string[]> {
  const snap = await getDocs(query(collectionGroup(db, 'tasks'), where(field, 'array-contains', identityValue)));
  const ids = new Set<string>();
  snap.docs.forEach((d) => {
    const data = d.data() as any;
    if (data.workOrderId && !homeProjectIds.includes(data.projectId || '')) ids.add(data.workOrderId);
  });
  return [...ids];
}

async function discoverExtraWoIdsByAssignedForeman(identityValue: string, homeProjectIds: string[]): Promise<string[]> {
  const snap = await getDocs(query(collectionGroup(db, 'tasks'), where('assignedForeman', '==', identityValue)));
  const ids = new Set<string>();
  snap.docs.forEach((d) => {
    const data = d.data() as any;
    if (data.workOrderId && !homeProjectIds.includes(data.projectId || '')) ids.add(data.workOrderId);
  });
  return [...ids];
}

async function discoverExtraWoIdsAsReporter(identity: Identity, homeProjectIds: string[]): Promise<string[]> {
  const ids = new Set<string>();
  for (const field of ['reporterId'] as const) {
    for (const value of [identity.id, identity.employeeId].filter(Boolean) as string[]) {
      const snap = await getDocs(query(collection(db, 'workOrders'), where(field, '==', value)));
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        if (!homeProjectIds.includes(data.projectId || '')) ids.add(d.id);
      });
    }
  }
  return [...ids];
}

export function useCrossProjectWorkOrders(enabled: boolean, identity: Identity | null, homeProjectIds: string[]): WorkOrder[] {
  const [extraWOs, setExtraWOs] = useState<WorkOrder[]>([]);

  const homeKey = [...homeProjectIds].sort().join(',');

  const run = useCallback(async () => {
    if (!enabled || !identity) {
      setExtraWOs([]);
      return;
    }
    try {
      const idValues = [identity.id, identity.employeeId].filter(Boolean) as string[];
      const idSets = await Promise.all([
        ...idValues.map((v) => discoverExtraWoIdsFromTasks('responsibleStaffIds', v, homeProjectIds)),
        ...idValues.map((v) => discoverExtraWoIdsFromTasks('helperForemanIds', v, homeProjectIds)),
        ...idValues.map((v) => discoverExtraWoIdsByAssignedForeman(v, homeProjectIds)),
        discoverExtraWoIdsAsReporter(identity, homeProjectIds),
      ]);
      const extraIds = [...new Set(idSets.flat())];
      if (extraIds.length === 0) {
        setExtraWOs([]);
        return;
      }

      const assembled: WorkOrder[] = [];
      for (const woId of extraIds) {
        const woSnap = await getDoc(doc(db, 'workOrders', woId));
        if (!woSnap.exists()) continue;
        const baseWO = { ...(woSnap.data() as WorkOrder), id: woSnap.id, categories: [] as any[] };
        const cache = await fetchWoSubtreeCache(woId);
        assembled.push(...assembleWorkOrders(cache, [baseWO]));
      }
      setExtraWOs(assembled);
    } catch (err) {
      console.error('[useCrossProjectWorkOrders] discovery failed:', err);
      setExtraWOs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, identity?.id, identity?.employeeId, homeKey]);

  useEffect(() => {
    run();
  }, [run]);

  return extraWOs;
}
