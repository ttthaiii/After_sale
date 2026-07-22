// T-335 — collectionGroup delta listeners for the WorkOrder subcollection tree.
//
// Replaces the old per-WO fetchSubcollections model (which re-read a work order's
// ENTIRE subcollection tree via getDocs on every doc change, amplified by a
// deliberate "touch write") with one collectionGroup onSnapshot listener per
// level. Firestore charges for the initial load once, then only CHANGED docs
// stream in via docChanges() — so repeated full-tree re-reads disappear and the
// touch-write hack becomes unnecessary.
//
// No status filter (see mece_plan S2, 2026-07-09): the bulk of the reads are
// `dailyReports`, which carry no status field, so filtering tasks/subtasks is
// marginal and would risk hiding completed work. Plain collectionGroup needs no
// composite index. The parent of any doc is reconstructed from its own path, so
// no denormalized parent-id fields are required.

import { useEffect, useRef, useState } from 'react';
import { collectionGroup, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  createWorkOrderCache,
  upsertDoc,
  removeDoc,
  clearCache,
  type WorkOrderCache,
  type CacheLevel,
} from '../store/workOrderCacheStore';

export interface RealtimeWorkOrders {
  /** The live flat cache (stable identity across renders — read via `version`). */
  cache: WorkOrderCache;
  /** Bumps on every delta batch → drive the assembler useMemo. */
  version: number;
  /** True until every listener has delivered its first snapshot. */
  loading: boolean;
  error: string | null;
}

/** The 6 collectionGroup listeners. `dailyReports` feeds two cache levels
 *  (revReports / helpReports) resolved per-doc by path, so its `level` here is
 *  a placeholder overridden in the handler. */
const GROUPS: { group: string; level: CacheLevel | 'dailyReports' }[] = [
  { group: 'categories', level: 'categories' },
  { group: 'tasks', level: 'tasks' },
  { group: 'subtasks', level: 'subtasks' },
  { group: 'revisions', level: 'revisions' },
  { group: 'help', level: 'help' },
  { group: 'dailyReports', level: 'dailyReports' },
];

/** Resolve a dailyReports doc to its cache level by inspecting the path:
 *  `.../help/<id>/dailyReports/<id>` → helpReports, else revReports. */
function reportLevel(path: string): CacheLevel {
  return path.includes('/help/') ? 'helpReports' : 'revReports';
}

/**
 * Opens the delta listeners while `enabled` is true, feeding the shared flat
 * cache. Returns the cache + a version counter the caller memoises the
 * assembler on. Clears everything and unsubscribes on disable / unmount.
 */
export function useRealtimeWorkOrders(enabled: boolean): RealtimeWorkOrders {
  // Cache identity is stable for the hook's lifetime; React re-renders are
  // driven by `version`, not by the cache object.
  const cacheRef = useRef<WorkOrderCache>(createWorkOrderCache());
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      clearCache(cacheRef.current);
      setLoading(false);
      return;
    }

    const cache = cacheRef.current;
    setLoading(true);
    setError(null);

    const unsubscribes: (() => void)[] = [];
    const firedGroups = new Set<string>();

    for (const { group, level } of GROUPS) {
      const unsub = onSnapshot(
        collectionGroup(db, group),
        (snapshot) => {
          for (const change of snapshot.docChanges()) {
            const path = change.doc.ref.path;
            // Safety: ignore any same-named collection outside the WO tree.
            if (!path.startsWith('workOrders/')) continue;

            const target: CacheLevel =
              group === 'dailyReports' ? reportLevel(path) : (level as CacheLevel);
            const item = { id: change.doc.id, path, data: change.doc.data() };

            if (change.type === 'removed') removeDoc(cache, target, path);
            else upsertDoc(cache, target, item); // added | modified
          }

          // First snapshot from every listener → cache is warm.
          if (!firedGroups.has(group)) {
            firedGroups.add(group);
            if (firedGroups.size === GROUPS.length) setLoading(false);
          }

          setVersion((v) => v + 1);
        },
        (err) => {
          console.error(`[useRealtimeWorkOrders] ${group} listener error:`, err);
          setError(err.message);
          setLoading(false);
        }
      );
      unsubscribes.push(unsub);
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
      clearCache(cacheRef.current);
    };
  }, [enabled]);

  return { cache: cacheRef.current, version, loading, error };
}
