// T-335 — collectionGroup delta listeners for the WorkOrder subcollection tree.
//
// Replaces the old per-WO fetchSubcollections model (which re-read a work order's
// ENTIRE subcollection tree via getDocs on every doc change, amplified by a
// deliberate "touch write") with one collectionGroup onSnapshot listener per
// level. Firestore charges for the initial load once, then only CHANGED docs
// stream in via docChanges() — so repeated full-tree re-reads disappear and the
// touch-write hack becomes unnecessary.
//
// T-craft (2026-07-23): every level now carries a `projectId` field (see the
// pre-prod-audit "Critical #1" fix). Admin/Manager/Approver still get the
// unfiltered firehose (`projectFilter === null`); every other role passes its
// `assignedProjects` array and each listener adds `where('projectId','in',chunk)`,
// chunked to Firestore's 30-value 'in' cap. A foreman assigned to a task OUTSIDE
// their home projects (rare, per user 2026-07-23) is NOT covered by these
// listeners — that rare cross-project case is handled by the separate
// `useCrossProjectWorkOrders` hook (one-time fetch, not realtime — an accepted
// tradeoff given how infrequently it happens).

import { useEffect, useRef, useState } from 'react';
import { collectionGroup, onSnapshot, query, where } from 'firebase/firestore';
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

/** Firestore 'in' filters accept at most 30 values. */
const IN_CHUNK_SIZE = 30;

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Resolve a dailyReports doc to its cache level by inspecting the path:
 *  `.../help/<id>/dailyReports/<id>` → helpReports, else revReports. */
function reportLevel(path: string): CacheLevel {
  return path.includes('/help/') ? 'helpReports' : 'revReports';
}

/**
 * Opens the delta listeners while `enabled` is true, feeding the shared flat
 * cache. Returns the cache + a version counter the caller memoises the
 * assembler on. Clears everything and unsubscribes on disable / unmount.
 *
 * @param projectFilter `null` = no filter (privileged roles, full company data).
 *   An array (possibly empty) = restrict every listener to `projectId in [...]`,
 *   chunked at 30 per Firestore's 'in' limit. An empty array means "no projects
 *   assigned" → zero listeners opened for that level (nothing to fetch).
 */
export function useRealtimeWorkOrders(enabled: boolean, projectFilter: string[] | null): RealtimeWorkOrders {
  // Cache identity is stable for the hook's lifetime; React re-renders are
  // driven by `version`, not by the cache object.
  const cacheRef = useRef<WorkOrderCache>(createWorkOrderCache());
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable dependency key for the effect below — re-subscribe only when the
  // actual filter contents change, not on every new array identity.
  const filterKey = projectFilter === null ? '__all__' : [...projectFilter].sort().join(',');

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

    // Total number of individual listeners we're about to open, so `loading`
    // only clears once every one of them has delivered a first snapshot.
    const chunks = projectFilter === null ? [null] : chunk(projectFilter, IN_CHUNK_SIZE);
    const totalListeners = GROUPS.length * Math.max(chunks.length, 0);
    let firedCount = 0;
    const markFired = () => {
      firedCount += 1;
      if (firedCount >= totalListeners) setLoading(false);
    };

    if (chunks.length === 0) {
      // No projects assigned at all — nothing to subscribe to for this role.
      setLoading(false);
    }

    for (const { group, level } of GROUPS) {
      for (const projectIds of chunks) {
        const q = projectIds === null
          ? collectionGroup(db, group)
          : query(collectionGroup(db, group), where('projectId', 'in', projectIds));

        let hasFired = false;
        const unsub = onSnapshot(
          q,
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

            if (!hasFired) {
              hasFired = true;
              markFired();
            }

            setVersion((v) => v + 1);
          },
          (err) => {
            console.error(`[useRealtimeWorkOrders] ${group} listener error:`, err);
            setError(err.message);
            if (!hasFired) {
              hasFired = true;
              markFired();
            }
          }
        );
        unsubscribes.push(unsub);
      }
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
      clearCache(cacheRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, filterKey]);

  return { cache: cacheRef.current, version, loading, error };
}
