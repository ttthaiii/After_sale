// T-335 — Flat delta cache for the WorkOrder subcollection tree.
//
// Framework-free by design: `zustand` is NOT a dependency in this project
// (it lives only in the sibling Labor repo). This cache has a single consumer,
// WorkOrderContext, which is already the app-global data source — so a separate
// global store would be pointless indirection. Instead this module exposes plain
// Maps + pure mutation/lookup helpers; reactivity is owned by the S2 hook
// (useRealtimeWorkOrders) which holds the cache in a ref and bumps a version
// counter to trigger re-assembly.
//
// Every doc is keyed by its FULL Firestore path, so a parent can always be
// reconstructed from a child's path (`change.doc.ref.path`) with no denormalized
// parent-id fields — the same trick the Labor delta listener uses.

/** The seven collection levels we cache. `dailyReports` appears under BOTH
 *  `revisions/*` and `help/*`; the delta hook splits them by path segment into
 *  revReports / helpReports so the assembler never has to guess. */
export type CacheLevel =
  | 'categories'
  | 'tasks'
  | 'subtasks'
  | 'revisions'
  | 'revReports'
  | 'help'
  | 'helpReports';

export interface CachedDoc {
  /** Firestore document id (last path segment). */
  id: string;
  /** Full Firestore path, e.g. workOrders/W1/categories/C1/tasks/T1. */
  path: string;
  /** Raw snapshot data (shaped later by the assembler). */
  data: any;
}

/** The flat cache: one Map per level, keyed by full path. */
export interface WorkOrderCache {
  categories: Map<string, CachedDoc>;
  tasks: Map<string, CachedDoc>;
  subtasks: Map<string, CachedDoc>;
  revisions: Map<string, CachedDoc>;
  revReports: Map<string, CachedDoc>;
  help: Map<string, CachedDoc>;
  helpReports: Map<string, CachedDoc>;
}

/** Fresh empty cache (all levels). */
export function createWorkOrderCache(): WorkOrderCache {
  return {
    categories: new Map(),
    tasks: new Map(),
    subtasks: new Map(),
    revisions: new Map(),
    revReports: new Map(),
    help: new Map(),
    helpReports: new Map(),
  };
}

/** Insert or replace a doc at the given level. Mutates in place (caller bumps
 *  its version counter to signal React). */
export function upsertDoc(cache: WorkOrderCache, level: CacheLevel, item: CachedDoc): void {
  cache[level].set(item.path, item);
}

/** Remove a doc by full path. No-op if absent. */
export function removeDoc(cache: WorkOrderCache, level: CacheLevel, path: string): void {
  cache[level].delete(path);
}

/** Empty every level (used on sign-out / listener teardown). */
export function clearCache(cache: WorkOrderCache): void {
  cache.categories.clear();
  cache.tasks.clear();
  cache.subtasks.clear();
  cache.revisions.clear();
  cache.revReports.clear();
  cache.help.clear();
  cache.helpReports.clear();
}

// ── Assembler helpers (pure — used by S3 assembleWorkOrders) ──────────────

/** Parent DOCUMENT path of a child doc path: drop the trailing
 *  `/<collection>/<docId>` pair.
 *  e.g. workOrders/W1/categories/C1/tasks/T1  →  workOrders/W1/categories/C1 */
export function parentPathOf(path: string): string {
  return path.split('/').slice(0, -2).join('/');
}

/** Group a level's docs by parent document path → Map<parentPath, CachedDoc[]>.
 *  One O(n) pass so the assembler can walk the tree without repeated prefix
 *  scans. */
export function groupByParent(map: Map<string, CachedDoc>): Map<string, CachedDoc[]> {
  const grouped = new Map<string, CachedDoc[]>();
  for (const item of map.values()) {
    const parent = parentPathOf(item.path);
    const bucket = grouped.get(parent);
    if (bucket) bucket.push(item);
    else grouped.set(parent, [item]);
  }
  return grouped;
}
