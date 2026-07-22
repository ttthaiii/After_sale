// T-335 — Assembler: rebuild the nested WorkOrder[] shape from the flat delta cache.
//
// This is a 1:1 port of WorkOrderContext.fetchSubcollections (the old
// getDocs-per-WO tree walk, L221-544 pre-T-335) that reads from the flat cache
// Maps instead of hitting Firestore. Its output MUST match the old function so
// every /dashboard consumer keeps working unchanged — that is the whole point of
// the full-port strategy. Business logic preserved verbatim: category/task id
// sorting, active-revision selection, dailyReports aggregation across revisions,
// support (help) virtual-task push, WOP field merge into the category, and the
// labor staffId/workerId back-compat mapping.
//
// Firestore's getDocs default order is document-id ascending, so anywhere the
// original relied on snapshot order we sort cache children by id to match.

import type { Category, MasterTask, DailyReport, WorkOrder } from '../types';
import {
  type WorkOrderCache,
  type CachedDoc,
  groupByParent,
} from '../store/workOrderCacheStore';

// ── date helpers (match the original site-by-site ordering) ────────────────

/** createdAt/revisionCreatedAt: original checks `.seconds` first, then toDate(). */
function createdAtToIso(v: any): string | null {
  if (!v) return null;
  if (typeof v === 'object' && v.seconds !== undefined) return new Date(v.seconds * 1000).toISOString();
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  return v;
}

/** dueDate: original checks toDate() first, then `.seconds`. */
function dueDateToIso(v: any): any {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  if (v.seconds) return new Date(v.seconds * 1000).toISOString();
  return v;
}

/** staffId/workerId back-compat mapping on a report's labor[] (verbatim). */
function mapLaborBackCompat(reports: DailyReport[]): DailyReport[] {
  return reports.map((report) => {
    if (report.labor) {
      const mappedLabor = report.labor.map((l: any) => ({
        ...l,
        staffId: l.staffId || l.workerId,
        staffName: l.staffName || l.workerName,
        workerId: l.workerId || l.staffId,
        workerName: l.workerName || l.staffName,
      }));
      return { ...report, labor: mappedLabor };
    }
    return report;
  });
}

const byIdAsc = (a: CachedDoc, b: CachedDoc) => a.id.localeCompare(b.id);

// ── parent→children indexes (built once per assembly, O(n) total) ──────────

interface CacheIndex {
  categoriesByWo: Map<string, CachedDoc[]>;
  tasksByCat: Map<string, CachedDoc[]>;
  subtasksByTask: Map<string, CachedDoc[]>;
  revisionsBySubtask: Map<string, CachedDoc[]>;
  revReportsByRev: Map<string, CachedDoc[]>;
  helpBySubtask: Map<string, CachedDoc[]>;
  helpReportsByHelp: Map<string, CachedDoc[]>;
}

function buildIndex(cache: WorkOrderCache): CacheIndex {
  return {
    categoriesByWo: groupByParent(cache.categories),
    tasksByCat: groupByParent(cache.tasks),
    subtasksByTask: groupByParent(cache.subtasks),
    revisionsBySubtask: groupByParent(cache.revisions),
    revReportsByRev: groupByParent(cache.revReports),
    helpBySubtask: groupByParent(cache.help),
    helpReportsByHelp: groupByParent(cache.helpReports),
  };
}

// ── the ported assembly (one WO) ───────────────────────────────────────────

function assembleCategoriesForWo(idx: CacheIndex, woId: string): Category[] {
  const woPath = `workOrders/${woId}`;
  const categories: Category[] = [];

  const catDocs = [...(idx.categoriesByWo.get(woPath) || [])].sort(byIdAsc);

  for (const catDoc of catDocs) {
    const catData = catDoc.data;
    const catPath = catDoc.path;
    const tasks: MasterTask[] = [];

    const taskDocs = [...(idx.tasksByCat.get(catPath) || [])].sort(byIdAsc);

    for (const taskDoc of taskDocs) {
      const taskData = taskDoc.data;
      const taskPath = taskDoc.path;

      let dailyreports: DailyReport[] = [];
      let currentRevision = 'rev00';
      let revisionCreatedAt: string | null = null;
      let subtaskName = taskData.subtaskName || '';
      let didPushSupportSubtask = false;
      let subtaskDailyProgress: number | null = null;

      const subtaskDocs = [...(idx.subtasksByTask.get(taskPath) || [])].sort(byIdAsc);

      for (const subtaskDoc of subtaskDocs) {
        const subtaskData = subtaskDoc.data;
        const subtaskPath = subtaskDoc.path;

        if (subtaskData.subtaskName) subtaskName = subtaskData.subtaskName;
        if (subtaskData.dailyProgress != null) subtaskDailyProgress = subtaskData.dailyProgress;

        const revDocs = [...(idx.revisionsBySubtask.get(subtaskPath) || [])].sort(byIdAsc);
        let subtaskRev = 'rev00';
        let subtaskRevCreatedAt: string | null = null;

        if (revDocs.length > 0) {
          // Active revision, or fallback to the latest one (highest id).
          const activeRevDoc =
            revDocs.find((d) => d.data.status === 'active') ||
            [...revDocs].sort((a, b) => b.id.localeCompare(a.id))[0];

          if (activeRevDoc) {
            subtaskRev = activeRevDoc.id;
            currentRevision = activeRevDoc.id;
            const revData = activeRevDoc.data;
            if (revData.createdAt) {
              subtaskRevCreatedAt = createdAtToIso(revData.createdAt);
              revisionCreatedAt = subtaskRevCreatedAt;
            }
          }

          // Aggregate daily reports across ALL revisions of this subtask.
          for (const revDoc of revDocs) {
            const revData = revDoc.data;
            const reportDocs = [...(idx.revReportsByRev.get(revDoc.path) || [])].sort(byIdAsc);
            for (const reportDoc of reportDocs) {
              const reportData = reportDoc.data;
              if (!dailyreports.some((r) => r.id === reportDoc.id || r.date === (reportData.date || reportDoc.id))) {
                dailyreports.push({
                  ...reportData,
                  id: reportDoc.id,
                  date: reportData.date || reportDoc.id,
                  isSupportReport: false,
                  revisionId: revDoc.id,
                  revisionStatus: revData.status || null,
                  revisionRejectReason: revData.rejectReason || null,
                  revisionDefectCategories: revData.defectCategories || null,
                  revisionRejectedAt: revData.rejectedAt || null,
                } as unknown as DailyReport);
              }
            }
          }
        } else {
          // No revision docs: fall back to the subtask's currentRevision path.
          subtaskRev = subtaskData.currentRevision || 'rev00';
          const reportDocs = [...(idx.revReportsByRev.get(`${subtaskPath}/revisions/${subtaskRev}`) || [])].sort(byIdAsc);
          for (const reportDoc of reportDocs) {
            const reportData = reportDoc.data;
            dailyreports.push({
              ...reportData,
              id: reportDoc.id,
              date: reportData.date || reportDoc.id,
              isSupportReport: false,
              revisionId: subtaskRev,
            } as unknown as DailyReport);
          }
        }

        // help subcollection (งานช่วย)
        const helpDocs = [...(idx.helpBySubtask.get(subtaskPath) || [])].sort(byIdAsc);
        let subtaskAssignedForeman = subtaskData.assignedForeman || '';
        let subtaskHelperForemanIds: string[] = subtaskData.helperForemanIds || [];
        const hasHelpDocs = helpDocs.length > 0;

        // Trace of foreman assignment from the other system (e.g. Labor).
        const supportFms =
          subtaskData.supportAssignees?.filter((a: any) => a.roleId === 'FM' || a.role === 'Foreman') || [];
        if (supportFms.length > 0) {
          subtaskHelperForemanIds = supportFms.map((a: any) => a.employeeId || a.id);
          subtaskAssignedForeman = subtaskHelperForemanIds[0] || '';
        }

        if (hasHelpDocs) {
          const targetHelpId = subtaskRev.replace('rev', 'help');
          const helpDoc = helpDocs.find((d) => d.id === targetHelpId) || helpDocs[0];
          if (helpDoc) {
            const helpData = helpDoc.data;
            const helpFms =
              helpData.assignees?.filter((a: any) => a.roleId === 'FM' || a.role === 'Foreman') || [];
            if (helpFms.length > 0) {
              subtaskHelperForemanIds = helpFms.map((a: any) => a.employeeId || a.id);
              subtaskAssignedForeman = subtaskHelperForemanIds[0] || '';
            } else {
              if (helpData.assignedForeman) subtaskAssignedForeman = helpData.assignedForeman;
              if (helpData.helperForemanIds) subtaskHelperForemanIds = helpData.helperForemanIds;
            }
          }
        }

        const subtaskIsSupport = subtaskData.isSupportRequest === true || hasHelpDocs;
        const subtaskIsPickedUp =
          subtaskData.isPickedUpBySupport === true || !!subtaskAssignedForeman || subtaskHelperForemanIds.length > 0;

        if (subtaskIsSupport) {
          let subtaskDailyreports: DailyReport[] = [];

          // help dailyReports (where helper daily reports are written) first.
          if (hasHelpDocs) {
            for (const helpDoc of helpDocs) {
              const helpReportDocs = [...(idx.helpReportsByHelp.get(helpDoc.path) || [])].sort(byIdAsc);
              for (const reportDoc of helpReportDocs) {
                const reportData = reportDoc.data;
                if (
                  !subtaskDailyreports.some(
                    (r) => (r.id === reportDoc.id || r.date === (reportData.date || reportDoc.id)) && r.isSupportReport === true
                  )
                ) {
                  subtaskDailyreports.push({
                    ...reportData,
                    id: reportDoc.id,
                    date: reportData.date || reportDoc.id,
                    isSupportReport: true,
                    revisionId: subtaskRev,
                  } as unknown as DailyReport);
                }
              }
            }
          }

          // Also revision daily reports (e.g. from a Labor source system).
          if (revDocs.length > 0) {
            for (const revDoc of revDocs) {
              const reportDocs = [...(idx.revReportsByRev.get(revDoc.path) || [])].sort(byIdAsc);
              for (const reportDoc of reportDocs) {
                const reportData = reportDoc.data;
                if (
                  !subtaskDailyreports.some(
                    (r) => (r.id === reportDoc.id || r.date === (reportData.date || reportDoc.id)) && r.isSupportReport === false
                  )
                ) {
                  subtaskDailyreports.push({
                    ...reportData,
                    id: reportDoc.id,
                    date: reportData.date || reportDoc.id,
                    isSupportReport: false,
                    revisionId: revDoc.id,
                  } as unknown as DailyReport);
                }
              }
            }
          } else {
            const reportDocs = [...(idx.revReportsByRev.get(`${subtaskPath}/revisions/${subtaskRev}`) || [])].sort(byIdAsc);
            for (const reportDoc of reportDocs) {
              const reportData = reportDoc.data;
              if (
                !subtaskDailyreports.some(
                  (r) => (r.id === reportDoc.id || r.date === (reportData.date || reportDoc.id)) && r.isSupportReport === false
                )
              ) {
                subtaskDailyreports.push({
                  ...reportData,
                  id: reportDoc.id,
                  date: reportData.date || reportDoc.id,
                  isSupportReport: false,
                  revisionId: subtaskRev,
                } as unknown as DailyReport);
              }
            }
          }

          subtaskDailyreports.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          const subtaskMappedReports = mapLaborBackCompat(subtaskDailyreports);

          // Push helper subtask as a separate virtual MasterTask (id = subtask id).
          tasks.push({
            ...taskData,
            id: subtaskDoc.id,
            parentTaskId: taskDoc.id,
            name: taskData.taskName || taskData.name || '',
            taskName: taskData.taskName || taskData.name || '',
            subtaskName: subtaskData.subtaskName || '',
            dailyProgress: subtaskData.dailyProgress || 0,
            isSupportRequest: true,
            isPickedUpBySupport: subtaskIsPickedUp,
            assignedForeman: subtaskAssignedForeman,
            helperForemanIds: subtaskHelperForemanIds,
            isHelper: true,
            status: subtaskData.status || taskData.status || 'Draft',
            currentRevision: subtaskRev,
            revisionCreatedAt: subtaskRevCreatedAt,
            dailyreports: subtaskMappedReports,
            history: subtaskMappedReports,
            responsibleStaffIds: taskData.responsibleStaffIds || [],
            dueDate: subtaskData.dueDate ? dueDateToIso(subtaskData.dueDate) : dueDateToIso(taskData.dueDate),
          } as unknown as MasterTask);
          didPushSupportSubtask = true;
        }
      }

      // Sort task-level daily reports descending by date + labor mapping.
      dailyreports.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const mappedDailyReports = mapLaborBackCompat(dailyreports);

      const taskCode = taskDoc.id;
      const name = taskData.taskName || taskData.name || '';
      const assignees = taskData.assignees || [];
      const responsibleStaffIds =
        taskData.responsibleStaffIds || (assignees.length > 0 ? assignees.map((a: any) => a.employeeId || a.id) : []);
      const status = taskData.status;

      let finalRevisionCreatedAt = revisionCreatedAt;
      if (!finalRevisionCreatedAt && taskData.revisionCreatedAt) {
        finalRevisionCreatedAt = createdAtToIso(taskData.revisionCreatedAt);
      }

      if (!didPushSupportSubtask) {
        tasks.push({
          ...taskData,
          id: taskDoc.id,
          name,
          taskName: name,
          subtaskName,
          responsibleStaffIds,
          status,
          taskCode,
          currentRevision,
          revisionCreatedAt: finalRevisionCreatedAt,
          dailyreports: mappedDailyReports,
          history: mappedDailyReports,
          dailyProgress: taskData.dailyProgress ?? subtaskDailyProgress ?? 0,
          isSupportRequest: false,
          isPickedUpBySupport: false,
          assignedForeman: '',
          helperForemanIds: [],
        } as unknown as MasterTask);
      }
    }

    // WOP (PreHandover): merge operational fields from the isPreHandover task
    // into the category so UI reads cat.currentRevision / cat.dailyProgress etc.
    const wopTask = tasks.find((t) => (t as any).isPreHandover === true);
    const wopMergedFields: Record<string, any> = {};
    if (wopTask) {
      const emp = (wopTask as any).assignees?.[0];
      if (emp?.employeeId) wopMergedFields.assignedForemanId = emp.employeeId;
      if (emp?.name) wopMergedFields.assignedForemanName = emp.name;
      const rev = (wopTask as any).currentRevision;
      if (rev != null) wopMergedFields.currentRevision = rev;
      const prog = (wopTask as any).dailyProgress;
      if (prog != null) wopMergedFields.dailyProgress = prog;
    }

    categories.push({ ...catData, ...wopMergedFields, id: catDoc.id, tasks } as Category);
  }

  return categories;
}

/**
 * Rebuild the nested WorkOrder[] the UI expects from the flat cache. `baseWOs`
 * are the work-order docs (base fields, empty categories) from the root
 * listener; each gets its `categories` assembled from the cache.
 */
export function assembleWorkOrders(cache: WorkOrderCache, baseWOs: WorkOrder[]): WorkOrder[] {
  const idx = buildIndex(cache);
  return baseWOs.map((wo) => ({
    ...wo,
    categories: assembleCategoriesForWo(idx, wo.id),
  }));
}
