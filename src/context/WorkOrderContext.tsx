import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { WorkOrder, MasterTask, DailyReport, Project, Staff, Contractor } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, getDocs, writeBatch, addDoc, serverTimestamp, Timestamp, query, where, documentId, deleteField, deleteDoc } from 'firebase/firestore';

import { TaskAssignee } from '../types';
import { useAuth } from './AuthContext';
import { deriveWoStatus } from '../utils/deriveWoStatus';
import { isWoaWop as isWoaWopType, getJobCode, resolveTaskRefs } from '../utils/workOrder';
import { logService } from '../services/logService';
import { useRealtimeWorkOrders } from '../hooks/useRealtimeWorkOrders';
import { useCrossProjectWorkOrders } from '../hooks/useCrossProjectWorkOrders';
import { useDraftReports, DraftReportEntry } from '../hooks/useDraftReports';
import { assembleWorkOrders } from '../utils/assembleWorkOrders';
import { useStableCallbacks } from '../hooks/useStableCallbacks';

const PRIVILEGED_ROLES = ['Admin', 'Manager', 'Approver'];
/** Firestore 'in' filters accept at most 30 values. */
const IN_CHUNK_SIZE = 30;
function chunkIds(arr: string[], size: number): string[][] {
    if (arr.length === 0) return [];
    const out: string[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

interface WorkOrderContextType {
    workOrders: WorkOrder[];
    getWorkOrderById: (id: string) => WorkOrder | undefined;
    updateTask: (workOrderId: string, categoryId: string, taskId: string, updates: Partial<MasterTask>) => Promise<void>;
    cancelRejectedTask: (workOrderId: string, categoryId: string, taskId: string) => Promise<void>;
    addWorkOrder: (wo: WorkOrder) => Promise<void>;
    updateWorkOrderStatus: (id: string, status: WorkOrder['status']) => Promise<void>;
    approvePreHandoverWO: (woId: string, confirmedSla: string, assignments: { catId: string; foremanId: string; foremanName: string }[], scheduledDate: string) => Promise<void>;
    saveEvaluation: (id: string, status: string, categories: any[]) => Promise<void>;
    addTaskUpdate: (workOrderId: string, categoryId: string, taskId: string, report: DailyReport) => Promise<void>;
    projects: Project[];
    staff: Staff[];
    contractors: Contractor[];
    loading: boolean;
    /** taskId -> that task's most recently updated pending (unsubmitted) draft.
     *  Only populated for Admin/Manager/Approver — see useDraftReports. */
    taskDrafts: Map<string, DraftReportEntry>;
    deleteWorkOrder: (id: string) => Promise<void>;
    archiveWorkOrder: (id: string) => Promise<void>;
    markWorkOrderAsReviewed: (id: string) => Promise<void>;
    requestRetroactiveUnlock: (workOrderId: string, categoryId: string, taskId: string, date: string, reason: string) => Promise<void>;
    submitRetroactiveRequest: (
        workOrderId: string,
        categoryId: string,
        taskId: string,
        date: string,
        payload: {
            progress: number;
            note: string;
            type: string;
            labor: any[];
            leave?: any[];
            photos?: any;
        },
        submittedBy: { uid: string; name: string }
    ) => Promise<void>;
    approveRetroactiveRequest: (requestId: string, workOrderId: string, approvedBy: { uid: string; name: string }) => Promise<void>;
    rejectRetroactiveRequest: (requestId: string, workOrderId: string, rejectedBy: { uid: string; name: string }, reason: string) => Promise<void>;
    approvePhRetroactiveRequest: (woId: string, catId: string, requestDate: string, approvedBy: { uid: string; name: string }) => Promise<void>;
    rejectPhRetroactiveRequest: (woId: string, catId: string, requestDate: string, rejectedBy: { uid: string; name: string }, reason: string) => Promise<void>;
    generateDeliveryQrToken: (woId: string, ownerId: string) => Promise<string>;
    submitCustomerInspection: (
        woId: string, 
        approvals: Record<string, { 
            status: 'approved' | 'rejected'; 
            reason?: string; 
            defectCategories?: Record<string, boolean>;
            contactName?: string;
            contactPhone?: string;
        }>,
        survey?: {
            workQuality: number;
            siteCleanliness: number;
            foremanProfessionalism: number;
            specAccuracy: number;
            handoverCare: number;
        }
    ) => Promise<void>;
    submitPhCustomerInspection: (
        woId: string,
        catApprovals: Record<string, { status: 'approved' | 'rejected'; reason?: string }>,
        survey?: { workQuality: number; siteCleanliness: number; foremanProfessionalism: number; specAccuracy: number; handoverCare: number }
    ) => Promise<void>;
    reviewRejectedPhWO: (woId: string, newScheduledDate?: string, slaCategory?: string, foremanId?: string) => Promise<void>;
    logCustomerQrView: (woId: string) => Promise<void>;
    markWorkOrderAsOpenedByAdmin: (id: string) => Promise<void>;
    requestSupport: (workOrderId: string, categoryId: string, taskId: string) => Promise<void>;
}

const WorkOrderContext = createContext<WorkOrderContextType | undefined>(undefined);

// ✅ Dropdown category list — same order as ForemanReportModal.tsx
// Position 1-indexed: หมวดงานทั่วไป=0001, งานโครงสร้าง=0002, งานปูนฉาบ=0003, งานกระเบื้อง=0004, ...
const CATEGORIES_LIST = [
    'หมวดงานทั่วไป (General)',        // pos 1 → 0001
    'งานโครงสร้าง',                    // pos 2 → 0002
    'งานปูนฉาบ/ผิวพื้นผนัง',          // pos 3 → 0003
    'งานกระเบื้อง/สุขภัณฑ์',          // pos 4 → 0004
    'งานไฟฟ้า',                        // pos 5 → 0005
    'งานระบบประปา/สุขาภิบาล',         // pos 6 → 0006
    'งานสี/เคลือบผิว',                 // pos 7 → 0007
    'งานฝ้าเพดาน',                     // pos 8 → 0008
    'งานบานประตู/หน้าต่าง',            // pos 9 → 0009
    'งานอลูมิเนียม/มุ้งลวด',           // pos 10 → 0010
    'งานเฟอร์นิเจอร์บิวท์อิน',        // pos 11 → 0011
    'งานระบบปรับอากาศ (Air)',           // pos 12 → 0012
    'งานระบบโทรศัพท์/อินเตอร์เน็ต',   // pos 13 → 0013
    'งานระบบแจ้งเหตุเพลิงใหม่',       // pos 14 → 0014
    'งานระบบความปลอดภัย',              // pos 15 → 0015
    'งานพื้น/พื้นไม้ลามิเนต',          // pos 16 → 0016
    // Append-only (2026-08-10): new taxonomy. Rows 1-16 above are the persistent
    // identity of every existing WO's category doc id — NEVER reorder/rename them.
    // Legacy combined names (pos 4 กระเบื้อง/สุขภัณฑ์, pos 3 ปูนฉาบ, pos 7 สี, pos 8 ฝ้า)
    // stay above so old WOs still resolve to their original code; new WOs pick these.
    'งานกระเบื้อง',                    // pos 17 → 0017
    'งานสุขภัณฑ์',                     // pos 18 → 0018
    'งานฉาบ-สี-ฝ้า (ตกแต่งผิว)',       // pos 19 → 0019
];

// ✅ Helper to format category and task IDs according to the LB structure
//
// Parses WO ID like: ART-2026-WOA-0002
//   projectCode = "ART"  (first segment)
//   jobCode     = "WOA"  (second-to-last segment)
//   woSeq       = "0002" (last segment)
//
// Category ID: [ProjectCode]-[JobCode]-[CatTypePos4digits]
//   e.g. งานกระเบื้อง in ART project → ART-WOA-0004   (unique per project + category type)
//
// Task ID: [ProjectCode]-[JobCode]-[WOSeq]-[globalTaskSeq7digits]
//   e.g. ART-WOA-0002-0000001   (globally unique: no two tasks in any project/WO can share this)
//
// ONLY applies to WOA/WOP work orders. All other codes are untouched.
const formatCategoriesAndTasks = (woId: string, categories: any[], woType?: string): any[] => {
    if (!categories || categories.length === 0) return [];

    // Guard: only WOA/WOP — decided via wo.type (isWoaWopType), not id string-matching
    if (!isWoaWopType({ type: woType, id: woId })) return categories;

    // Parse WO ID — e.g. ART-2026-WOA-0002 (structural parsing of the id's own shape;
    // unrelated to WOA/WOP classification, which comes from woType above)
    const parts = woId.split('-');
    const projectPrefix = parts.length > 0 ? parts[0].toUpperCase() : 'LR';
    const jobCode     = getJobCode({ type: woType }); // "WOA" | "WOP"
    const woSeq       = parts.length >= 1 ? parts[parts.length - 1] : '0001';

    // Pad woSeq to 4 digits for standard display (e.g. 0001)
    const formattedWoSeq = String(parseInt(woSeq) || 0).padStart(4, '0');

    let taskCounter = 0;

    return categories.map((cat, catIndex) => {
        const catName = (cat.name || '').trim().toLowerCase();
        const listIndex = CATEGORIES_LIST.findIndex(n => n.trim().toLowerCase() === catName);

        // 1-indexed category type position. A name not in the fixed list (e.g. a
        // user-typed "หมวดอื่นๆ" category) falls back to a slot number well past
        // the list's own range (1-16) — using catIndex+1 directly would collide
        // with a real listed category's position and silently overwrite it in
        // Firestore, since both share the same [projectPrefix]-[jobCode]-[position]-[woSeq]
        // doc id (feedback 2026-08-04).
        const position = listIndex >= 0 ? listIndex + 1 : 500 + catIndex;
        const formattedPosition = String(position).padStart(4, '0');

        // Category ID: [ProjectPrefix]-[ProjectCode]-[CategorySeq]-[WOSeq] (e.g. LR-WOA-0003-0001)
        const computedCatId = `${projectPrefix}-${jobCode}-${formattedPosition}-${formattedWoSeq}`;

        // Task ID: [ProjectPrefix]-[ProjectCode]-[CategorySeq]-[WOSeq]-[TaskCount 4 digits] (e.g. LR-WOA-0003-0001-0001)
        const tasks = cat.tasks ? cat.tasks.map((task: any) => {
            taskCounter++;
            const taskSeq = String(taskCounter).padStart(4, '0');
            const computedTaskId = `${projectPrefix}-${jobCode}-${formattedPosition}-${formattedWoSeq}-${taskSeq}`;
            const computedSubtaskId = `${jobCode}-${formattedPosition}-${formattedWoSeq}-${taskSeq}`;
            return {
                ...task,
                id: computedTaskId,
                taskCode: computedTaskId,
                catId: computedCatId,
                subtaskId: computedSubtaskId
            };
        }) : [];

        return {
            ...cat,
            id: computedCatId,
            catId: computedCatId,
            catName: cat.name || cat.catName || '',
            name: cat.name || cat.catName || '',
            tasks
        };
    });
};

// Helper function to resolve subtask ID from task ID
const getSubtaskId = (taskId: string): string => {
    // Strip project prefix if present → e.g. "LR-WOA-0003-0001-0001" → "WOA-0003-0001-0001"
    if (taskId) {
        return taskId.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
    }
    return taskId;
};

// ✅ Resolve task assignee details from the users collection for LB schema compatibility.
// Batched via a single `where(documentId(), 'in', chunk)` query per 30 ids (Firestore's
// 'in' cap) instead of one getDoc per staff id — was N reads, now ceil(N/30).
const RESOLVE_ASSIGNEES_CHUNK_SIZE = 30;
const resolveAssignees = async (staffIds: string[]): Promise<TaskAssignee[]> => {
    if (!staffIds || staffIds.length === 0) return [];
    const uniqueIds = [...new Set(staffIds)];
    const foundById = new Map<string, TaskAssignee>();

    const chunks: string[][] = [];
    for (let i = 0; i < uniqueIds.length; i += RESOLVE_ASSIGNEES_CHUNK_SIZE) {
        chunks.push(uniqueIds.slice(i, i + RESOLVE_ASSIGNEES_CHUNK_SIZE));
    }

    try {
        await Promise.all(chunks.map(async (chunk) => {
            const snap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)));
            snap.docs.forEach((userDoc) => {
                const userData = userDoc.data();
                foundById.set(userDoc.id, {
                    employeeId: userData.employeeId || userDoc.id,
                    name: userData.name || '',
                    roleId: userData.roleId || (userData.role === 'Admin' ? 'AM' : 'FM')
                });
            });
        }));
    } catch (error) {
        console.error("Error resolving assignee details:", error);
    }

    // Preserve input order (incl. duplicates); fall back per id with no matching user doc.
    return staffIds.map((staffId) => foundById.get(staffId) || {
        employeeId: staffId,
        name: `Staff ${staffId}`,
        roleId: 'FM'
    });
};

export const WorkOrderProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [allWorkOrders, setAllWorkOrders] = useState<WorkOrder[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(true);

    // T-craft (2026-07-23): privileged roles keep the full-company firehose;
    // everyone else is scoped to their assignedProjects at the query level
    // (see pre-prod-audit "Critical #1"). `null` = unfiltered.
    const isPrivileged = !!user && PRIVILEGED_ROLES.includes(user.role);
    const projectFilter: string[] | null = isPrivileged ? null : (user?.assignedProjects || []);

    // T-335: collectionGroup delta listeners feed a flat cache. `version` bumps on
    // every delta batch and drives the assembler useMemo below. Replaces the old
    // per-WO fetchSubcollections full-tree re-reads.
    const { cache: rtCache, version: rtVersion } = useRealtimeWorkOrders(!!user, projectFilter);

    // Admin/Manager-only: realtime foreman drafts (in-progress, not yet
    // submitted) so they can track today's progress before end-of-day submit.
    const taskDrafts = useDraftReports(!!user && isPrivileged);

    // Rare cross-project assignment case (helper/responsible/reporter outside the
    // user's home projects) — one-time discovery fetch, not realtime. See
    // hooks/useCrossProjectWorkOrders.ts for why this isn't a listener.
    const crossProjectWOs = useCrossProjectWorkOrders(
        !!user && !isPrivileged,
        user ? { id: user.id, employeeId: user.employeeId } : null,
        projectFilter || []
    );

    // ✅ REAL-TIME SYNC: Reverting to a more stable root listener with reactive integration
    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const handleWoSnapshot = (snapshot: any) => {
            const changes = snapshot.docChanges();
            const toFetch = changes.filter((c: any) => c.type === 'added' || c.type === 'modified');
            const toRemove = changes.filter((c: any) => c.type === 'removed').map((c: any) => c.doc.id);

            // Step 1: แสดง UI ทันทีด้วย base data (ไม่รอ subcollections)
            const baseWOs = toFetch.map((change: any) => ({
                ...(change.doc.data() as WorkOrder),
                status: (change.doc.data() as WorkOrder).status || 'In Progress',
                id: change.doc.id,
                categories: [] as any[]
            }));

            setAllWorkOrders(prev => {
                let result = [...prev];
                if (toRemove.length > 0) result = result.filter(wo => !toRemove.includes(wo.id));
                for (const wo of baseWOs) {
                    const idx = result.findIndex(w => w.id === wo.id);
                    if (idx >= 0) result[idx] = wo;
                    else result.push(wo);
                }
                return result;
            });
            setLoading(false); // UI โชว์ทันที

            // T-335: subcollections no longer fetched per-WO here. The base WOs
            // (categories: []) are assembled with the live cache in the useMemo below.
        };

        // Privileged roles: one unfiltered listener. Everyone else: one listener
        // per chunk of assignedProjects (Firestore 'in' caps at 30 values); zero
        // projects assigned → zero listeners (nothing to fetch this way — the
        // cross-project hook is that user's only source).
        const woChunks = projectFilter === null ? [null] : chunkIds(projectFilter, IN_CHUNK_SIZE);
        const unsubscribesWO = woChunks.map(ids =>
            onSnapshot(
                ids === null ? collection(db, 'workOrders') : query(collection(db, 'workOrders'), where('projectId', 'in', ids)),
                handleWoSnapshot
            )
        );

        const unsubProjects = onSnapshot(collection(db, 'projects'), s => setProjects(s.docs.map(d => ({ ...d.data(), id: d.id }) as Project)));
        const unsubUsers = onSnapshot(collection(db, 'users'), s => {
            const mappedStaff = s.docs.map(docSnapshot => {
                const userData = docSnapshot.data();
                const empId = docSnapshot.id;
                
                // After Sale owns role as a full name; fall back to legacy Labor code only for old records
                const rawRole = userData.role;
                let role: 'Foreman' | 'Admin' | 'Manager' | 'Approver' =
                    (rawRole === 'Admin' || rawRole === 'Manager' || rawRole === 'Approver' || rawRole === 'Foreman')
                        ? rawRole
                        : (userData.roleId === 'AM' || userData.roleId === 'PE' ? 'Admin' : 'Foreman');
                
                return {
                    id: empId,
                    employeeId: userData.employeeId || empId,
                    name: userData.name || '',
                    role: role,
                    department: userData.department || '',
                    phone: userData.phone || '',
                    affiliation: userData.department || 'T.T.S. ENGINEERING',
                    profileImage: userData.profileImage || '',
                    username: userData.username || '',
                    password: userData.password || '',
                    assignedProjects: userData.projectLocationIds || [],
                    projectLocationIds: userData.projectLocationIds || [],
                    systemCode: userData.systemCode || ''
                } as Staff;
            }).filter(st => st.systemCode === 'AS'); // Only show users belonging to After Sale (systemCode: "AS")
            setStaff(mappedStaff);
        });
        const unsubContractors = onSnapshot(collection(db, 'contractors'), s => setContractors(s.docs.map(d => ({ ...d.data(), id: d.id }) as Contractor)));

        // T-335: unsubscribe ALL listeners (previously only unsubscribeWO was
        // returned — projects/users/contractors leaked on user change / unmount).
        return () => {
            unsubscribesWO.forEach(unsub => unsub());
            unsubProjects();
            unsubUsers();
            unsubContractors();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isPrivileged, (projectFilter || []).slice().sort().join(',')]);

    // T-335: rebuild the nested WorkOrder[] (categories/tasks/subtasks/reports)
    // from the flat delta cache. Re-runs when base WOs change or a delta arrives
    // (rtVersion). Output shape matches the old fetchSubcollections so consumers
    // stay unchanged.
    const assembledWorkOrders = useMemo(
        () => assembleWorkOrders(rtCache, allWorkOrders),
        [allWorkOrders, rtVersion, rtCache]
    );

    // ✅ Filter the final list for the UI. The heavy lifting (restricting to the
    // user's own projects) now happens at the Firestore query level (see the
    // listeners above) — this filter is a lightweight safety net, and it's also
    // what lets the rare cross-project WOs (merged in below) through via the
    // isReporter/isResponsible branches even though they're outside assignedProjects.
    const workOrders = useMemo(() => {
        if (!user) return [];
        const combined = isPrivileged ? assembledWorkOrders : [...assembledWorkOrders, ...crossProjectWOs];
        let filtered = combined;
        if (user.role !== 'Admin' && user.role !== 'Manager' && user.role !== 'Approver') {
            filtered = combined.filter(wo => {
                const isAssignedProject = user.assignedProjects?.includes(wo.projectId || '');
                // ✅ Check match against BOTH system id and employeeId during transition
                const isReporter = wo.reporterId === user.id || (user.employeeId && wo.reporterId === user.employeeId);
                
                // Also check if they are responsible or assigned as helper for any task in this WO
                const isResponsible = wo.categories?.some(cat => 
                    cat.tasks?.some(task => 
                        task.responsibleStaffIds?.includes(user.id) || 
                        (user.employeeId && task.responsibleStaffIds?.includes(user.employeeId)) ||
                        task.helperForemanIds?.includes(user.id) ||
                        (user.employeeId && task.helperForemanIds?.includes(user.employeeId)) ||
                        task.assignedForeman === user.id ||
                        (user.employeeId && task.assignedForeman === user.employeeId)
                    )
                );

                return isAssignedProject || isReporter || isResponsible;
            });
        }
        return filtered;
    }, [assembledWorkOrders, crossProjectWOs, isPrivileged, user]);

    const getWorkOrderById = (id: string) => workOrders.find(wo => wo.id === id);

    const addWorkOrder = async (wo: WorkOrder) => {
        // Eval-lock guard: FM create/edit both funnel through here. Blocked while an admin has the
        // WO open for evaluation (evalLocked). A brand-new WO doc doesn't exist yet → no throw → create ok.
        await assertNotEvalLocked(wo.id);

        // Format categories and tasks to have structured document IDs matching the LB format for WOA/WOP
        const formattedCategories = formatCategoriesAndTasks(wo.id, wo.categories || [], wo.type);
        const woWithFormattedCategories = {
            ...wo,
            categories: formattedCategories
        };
        const { categories, ...rest } = woWithFormattedCategories;

        const workOrderCode = getJobCode(wo);

        // Clean up any existing categories/tasks for this work order to prevent orphans.
        // Reads at each tree level are independent (different category/task/subtask/revision
        // ids), so siblings are scanned concurrently via Promise.all instead of one at a time —
        // was a fully sequential O(depth) chain of round-trips per branch, now O(depth) latency
        // total regardless of branch count. deleteBatch.delete() is a synchronous local queue
        // op, so calling it from concurrent callbacks is safe.
        try {
            const oldCategoriesSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories'));
            if (!oldCategoriesSnap.empty) {
                const deleteBatch = writeBatch(db);
                await Promise.all(oldCategoriesSnap.docs.map(async (catDoc) => {
                    const oldTasksSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks'));
                    await Promise.all(oldTasksSnap.docs.map(async (taskDoc) => {
                        // Deep delete subtasks, revisions, dailyReports
                        const oldSubtasksSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks'));
                        await Promise.all(oldSubtasksSnap.docs.map(async (subtaskDoc) => {
                            const oldRevisionsSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions'));
                            await Promise.all(oldRevisionsSnap.docs.map(async (revDoc) => {
                                const oldReportsSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id, 'dailyReports'));
                                oldReportsSnap.docs.forEach((reportDoc) => {
                                    deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id, 'dailyReports', reportDoc.id));
                                });
                                deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id));
                            }));
                            deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'subtasks', subtaskDoc.id));
                        }));
                        deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id));
                    }));
                    deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id));
                }));
                await deleteBatch.commit();
            }
        } catch (error) {
            console.error("Error cleaning up legacy subcollections in addWorkOrder:", error);
        }

        // Store workOrderCode and workOrderId at root document
        const rootDocData = {
            ...rest,
            workOrderCode,
            workOrderId: wo.id
        };
        await setDoc(doc(db, 'workOrders', wo.id), rootDocData);
        
        if (formattedCategories && formattedCategories.length > 0) {
            // Resolve every task's assignees up front, in parallel, instead of sequentially
            // awaiting resolveAssignees() once per task inside the write loop below.
            const allTasks = formattedCategories.flatMap((cat: any) => cat.tasks || []);
            const assigneesByTaskId = new Map<string, TaskAssignee[]>();
            await Promise.all(allTasks.map(async (task: any) => {
                assigneesByTaskId.set(task.id, await resolveAssignees(task.responsibleStaffIds || []));
            }));

            const batch = writeBatch(db);
            for (const cat of formattedCategories) {
                const catRef = doc(db, 'workOrders', wo.id, 'categories', cat.id);
                const { tasks, ...catRest } = cat;

                // Write Category with catName and name
                batch.set(catRef, {
                    ...catRest,
                    catName: cat.name || cat.catName || '',
                    name: cat.name || cat.catName || '',
                    projectId: wo.projectId || '',
                    updatedAt: new Date().toISOString()
                });

                if (tasks) {
                    for (const task of tasks) {
                        const { dailyreports, dailyReport, history, ...taskRest } = task;
                        const assignees = assigneesByTaskId.get(task.id) || [];

                        // Map status to LB
                        // Single source of truth: store the new CamelCase task vocab directly.
                        const lbStatus = task.status || 'Draft';

                        const taskRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', task.id);
                        batch.set(taskRef, {
                            ...taskRest,
                            taskName: task.name || task.taskName || '',
                            assignees,
                            status: lbStatus,
                            taskId: task.id,
                            workOrderId: wo.id,
                            workOrderCode: workOrderCode, // short code!
                            workOrderName: wo.locationName || '',
                            categoryId: cat.id,
                            categoryName: cat.name || cat.catName || '',
                            projectId: wo.projectId || '',
                            isActive: task.isActive !== false
                        });

                        // Subtask ID: [taskId]-0001
                        const subtaskId = getSubtaskId(task.id);
                        const subtaskRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId);
                        batch.set(subtaskRef, {
                            subtaskId,
                            subtaskName: task.name || task.taskName || '',
                            status: lbStatus,
                            dailyProgress: task.dailyProgress || 0,
                            assignees,
                            currentRevision: task.currentRevision || 'rev00',
                            projectId: wo.projectId || '',
                            isActive: true
                        });

                        // Revision ID: task.currentRevision || 'rev00'
                        const revId = task.currentRevision || 'rev00';
                        const revisionRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId, 'revisions', revId);
                        batch.set(revisionRef, {
                            revisionId: revId,
                            revisionName: task.revisionName || 'Initial Revision',
                            status: 'active',
                            projectId: wo.projectId || '',
                            createdAt: task.revisionCreatedAt || new Date().toISOString()
                        });

                        const reportsToSave = dailyreports || dailyReport || history || [];
                        for (const report of reportsToSave) {
                            // Document ID is report date YYYY-MM-DD for LB compatibility
                            const reportDate = report.date.includes('T') ? report.date.split('T')[0] : report.date;
                            const reportRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId, 'revisions', revId, 'dailyReports', reportDate);
                            
                            // Map labor fields in reports for LB compatibility on write
                            let mappedReport = { ...report, projectId: wo.projectId || '' };
                            if (report.labor) {
                                const mappedLabor = report.labor.map((l: any) => ({
                                    ...l,
                                    workerId: l.workerId || l.staffId,
                                    workerName: l.workerName || l.staffName,
                                    staffId: l.staffId || l.workerId,
                                    staffName: l.staffName || l.workerName
                                }));
                                mappedReport.labor = mappedLabor;
                            }
                            batch.set(reportRef, mappedReport);
                        }
                    }
                }
            }
            await batch.commit();
        }
    };

    const saveEvaluation = async (id: string, status: string, categories: any[]) => {

        // T-341 (Option B): IDs are immutable. Do NOT regenerate task ids on an evaluation —
        // regenerating diverged the recomputed ids from the stored ones (global taskCounter in
        // formatCategoriesAndTasks) so cleanup kept the old docs while the write added new ones =
        // duplicates. Using the input categories (existing stored ids) makes the write overwrite in
        // place. Callers (Evaluation.tsx, SLAMonitor.tsx) only modify existing tasks, never add new
        // ones, so no id generation is needed here. (Creation still uses the formatter in addWorkOrder.)
        const formattedCategories = categories || [];
        const parentWO = allWorkOrders.find(w => w.id === id);
        const projectId = parentWO?.projectId || '';
        const locationName = parentWO?.locationName || '';

        const workOrderCode = getJobCode({ type: parentWO?.type, id });

        // Clean up any categories/tasks that were actually deleted in the new list to prevent
        // orphans. Sibling reads at each tree level are independent, so scanned concurrently via
        // Promise.all (was a fully sequential O(depth) chain per branch) — see addWorkOrder above
        // for the same pattern.
        try {
            const oldCategoriesSnap = await getDocs(collection(db, 'workOrders', id, 'categories'));
            if (!oldCategoriesSnap.empty) {
                const deleteBatch = writeBatch(db);
                const newCatIds = new Set((categories || []).map(c => c.id));
                const newExecutionTaskIds = new Set((categories || []).flatMap(c => (c.tasks || []).map((t: any) => t.id)));

                await Promise.all(oldCategoriesSnap.docs.map(async (catDoc) => {
                    const oldTasksSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks'));
                    await Promise.all(oldTasksSnap.docs.map(async (taskDoc) => {
                        const taskId = taskDoc.id;

                        // Only delete subcollections & task doc if it is NOT in the new list
                        if (!newExecutionTaskIds.has(taskId)) {
                            const oldSubtasksSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'subtasks'));
                            await Promise.all(oldSubtasksSnap.docs.map(async (subtaskDoc) => {
                                const oldRevisionsSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskDoc.id, 'revisions'));
                                await Promise.all(oldRevisionsSnap.docs.map(async (revDoc) => {
                                    const oldReportsSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id, 'dailyReports'));
                                    oldReportsSnap.docs.forEach((reportDoc) => {
                                        deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id, 'dailyReports', reportDoc.id));
                                    });
                                    deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskDoc.id, 'revisions', revDoc.id));
                                }));
                                deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskDoc.id));
                            }));
                            deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskId));
                        }
                    }));
                    if (!newCatIds.has(catDoc.id)) {
                        deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id));
                    }
                }));
                await deleteBatch.commit();
            }
        } catch (error) {
            console.error("Error cleaning up legacy subcollections in saveEvaluation:", error);
        }

        // Check if there are any remaining rejected tasks in the new list
        let hasRejectedTasks = false;
        for (const cat of formattedCategories) {
            if (cat.tasks) {
                for (const t of cat.tasks) {
                    if (t.status === 'Rejected') {
                        hasRejectedTasks = true;
                    }
                }
            }
        }

        const batch = writeBatch(db);
        
        // Define root WO updates
        const woUpdates: any = { 
            status, 
            lastUpdate: new Date().toISOString(),
            workOrderCode,
            workOrderId: id
        };

        // Only update reviewedByAdmin if the WO is NOT in customer-Rejected state.
        // When a customer rejects, submitCustomerInspection sets reviewedByAdmin=false.
        // saveEvaluation (admin evaluation flow) must NOT override that flag until
        // the admin explicitly re-assigns via updateTask which handles the transition.
        const isCurrentlyCustomerRejected = parentWO?.status === 'customer_reject';
        if (!isCurrentlyCustomerRejected) {
            if (!hasRejectedTasks) {
                woUpdates.reviewedByAdmin = true;
                woUpdates.adminReviewedAt = new Date().toISOString();
            } else {
                woUpdates.reviewedByAdmin = false;
            }
        }

        // Pessimistic-lock lifecycle: an admin decision that moves the WO out of 'Evaluating'
        // closes the review window → release the lock. A partial decision that keeps the WO
        // in 'Evaluating' leaves it locked (admin is still reviewing).
        if (status !== 'Evaluating') {
            woUpdates.evalLocked = false;
            woUpdates.evalLockedBy = '';
        }


        batch.update(doc(db, 'workOrders', id), woUpdates);

        // Resolve every task's assignees up front, in parallel, instead of sequentially awaiting
        // resolveAssignees() once per task inside the write loop below.
        const allTasksForEval = formattedCategories.flatMap((cat: any) => cat.tasks || []);
        const assigneesByTaskIdForEval = new Map<string, TaskAssignee[]>();
        await Promise.all(allTasksForEval.map(async (task: any) => {
            assigneesByTaskIdForEval.set(task.id, await resolveAssignees(task.responsibleStaffIds || []));
        }));

        for (const cat of formattedCategories) {
            const catRef = doc(db, 'workOrders', id, 'categories', cat.id);
            const { tasks, ...catRest } = cat;

            // Save Category with name and catName
            batch.set(catRef, {
                ...catRest,
                catName: cat.name || cat.catName || '',
                name: cat.name || cat.catName || '',
                projectId: projectId,
                updatedAt: new Date().toISOString()
            });

            if (tasks) {
                for (const task of tasks) {
                    const { dailyreports, dailyReport, history, ...taskRest } = task;
                    const assignees = assigneesByTaskIdForEval.get(task.id) || [];

                    // Single source of truth: store the new CamelCase task vocab directly (no LB translation).
                    // Reset progress for tasks that have not started work yet.
                    const notStarted = task.status === 'Draft' || task.status === 'Evaluating' || task.status === 'Assigned';
                    const progressVal = notStarted ? 0 : (task.dailyProgress || 0);

                    const taskRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id);
                    batch.set(taskRef, {
                        ...taskRest,
                        taskName: task.name || task.taskName || '',
                        assignees,
                        status: task.status,
                        dailyProgress: progressVal, // Force progress reset if not started
                        taskId: task.id,
                        workOrderId: id,
                        workOrderCode: workOrderCode, // short code!
                        workOrderName: locationName,
                        categoryId: cat.id,
                        categoryName: cat.name || cat.catName || '',
                        projectId: projectId,
                        isActive: task.isActive !== false
                    });

                    // Subtask ID: [taskId]-0001
                    const subtaskId = getSubtaskId(task.id);
                    const subtaskRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId);
                    batch.set(subtaskRef, {
                        subtaskId,
                        subtaskName: task.name || task.taskName || '',
                        status: task.status,
                        dailyProgress: progressVal,
                        assignees,
                        subtaskOperatorId: task.subtaskOperatorId || (task.responsibleStaffIds && task.responsibleStaffIds[0]) || "",
                        currentRevision: task.currentRevision || 'rev00',
                        projectId: projectId,
                        isActive: true
                    });

                    // Revision ID: task.currentRevision || 'rev00'
                    const revId = task.currentRevision || 'rev00';
                    const revisionRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id, 'subtasks', subtaskId, 'revisions', revId);
                    batch.set(revisionRef, {
                        revisionId: revId,
                        revisionName: task.revisionName || 'Initial Revision',
                        status: 'active',
                        projectId: projectId,
                        createdAt: task.revisionCreatedAt || new Date().toISOString()
                    });

                    // Skip writing/recreating daily reports during saveEvaluation.
                    // This prevents cloning old reports to the new revision context.
                }
            }
        }
        await batch.commit();
    };

    // Pessimistic-lock server guard: refuse foreman-side mutations while an admin has the WO
    // open for evaluation. Lock is keyed purely on evalLocked (set when admin opens an Evaluating
    // WO, cleared when the admin's decision moves it out of Evaluating) — immune to status timing.
    // Office roles (Admin/Manager/Approver) are exempt so the admin's own assign/approve never self-blocks.
    const assertNotEvalLocked = async (workOrderId: string) => {
        const role = (user as any)?.role;
        if (role === 'Admin' || role === 'Manager' || role === 'Approver') return;
        const woSnap = await getDoc(doc(db, 'workOrders', workOrderId));
        if (woSnap.exists()) {
            const d = woSnap.data();
            if (d.evalLocked === true) {
                throw new Error('WO_LOCKED_FOR_REVIEW');
            }
        }
    };

    const addTaskUpdate = async (workOrderId: string, categoryId: string, taskId: string, report: DailyReport) => {
        // Ensure date is in a clean YYYY-MM-DD format for dashboard filtering if it's an ISO string
        const reportDate = report.date.includes('T') ? report.date.split('T')[0] : report.date;
        
        const finalReport = {
            ...report,
            date: reportDate, // Standardize to YYYY-MM-DD for consistency
            serverTimestamp: new Date().toISOString() // Keep track of when it was actually clicked
        };

        const isWoaWop = isWoaWopType(allWorkOrders.find(w => w?.id === workOrderId));
        // Resolve parent/subtask ids structurally (labor principle) — no id-string slicing.
        const refs = resolveTaskRefs(allWorkOrders, workOrderId, categoryId, taskId);
        const { parentTaskId, subtaskId, isSubtask } = refs;
        // The in-memory allWorkOrders tree may carry no categories for this WO (the
        // admin list is lightweight), so read the parent task doc from Firestore —
        // the single source of truth — instead of trusting the in-memory copy.
        let taskDoc: any = refs.taskDoc;
        try {
            const parentSnap = await getDoc(doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId));
            if (parentSnap.exists()) taskDoc = { id: parentSnap.id, ...parentSnap.data() };
        } catch (e) { console.error('[addTaskUpdate] parent task fetch failed', e); }
        const currentRev = taskDoc?.currentRevision || 'rev00';

        // Helper report = genuine helper/support context (structural flag or helper roster),
        // NOT inferred from id-segment count. A primary subtask (no helper flags) cascades status.
        const isHelperReport = taskDoc?.isHelper === true || taskDoc?.isSupportRequest === true || (taskDoc?.helperForemanIds?.includes(report.createdBy) ?? false) || taskDoc?.assignedForeman === report.createdBy;

        if (isWoaWop || isSubtask) {
            if (isHelperReport) {
                const helpId = currentRev.replace('rev', 'help');
                const helpDocRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'help', helpId);
                await setDoc(helpDocRef, { helpId, projectId: taskDoc?.projectId || '', createdAt: new Date().toISOString() }, { merge: true });

                const parentWO = allWorkOrders.find(w => w?.id === workOrderId);
                const projectId = parentWO?.projectId || '';
                const projectObj = projects.find(p => p.id === projectId);
                const projectName = projectObj?.name || '';

                // Construct Firestore Timestamps for helper daily reports to match the Labor system
                let createdAtVal: any = Timestamp.now();
                if (report.createdAt) {
                    if (typeof report.createdAt === 'string') {
                        createdAtVal = Timestamp.fromDate(new Date(report.createdAt));
                    } else {
                        createdAtVal = report.createdAt;
                    }
                }
                const updatedAtVal = Timestamp.now();
                const reportDateVal = Timestamp.fromDate(new Date(reportDate + 'T00:00:00'));

                const helperFinalReport = {
                    ...finalReport,
                    createdAt: createdAtVal,
                    updatedAt: updatedAtVal,
                    reportDate: reportDateVal,
                    projectId: projectId,
                    projectName: projectName,
                    status: (report as any).status || 'submitted',
                    isSupportReport: true,
                    editHistory: (report as any).editHistory || []
                };

                // Save helper daily report
                const reportRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'help', helpId, 'dailyReports', reportDate);
                await setDoc(reportRef, helperFinalReport);


                // Step 2: Trigger daily report sync API immediately after successful write
                try {
                    const reportPath = `workOrders/${workOrderId}/categories/${categoryId}/tasks/${parentTaskId}/subtasks/${subtaskId}/help/${helpId}/dailyReports/${reportDate}`;
                    console.log('Syncing helper daily report to LB API...', { reportPath, reportDate });
                    const syncResponse = await fetch('https://asia-southeast1-after-sale-system.cloudfunctions.net/syncDailyReport', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            reportPath,
                            reportDate
                        })
                    });

                    if (!syncResponse.ok) {
                        console.error('Failed to sync helper daily report:', syncResponse.status, await syncResponse.text());
                    } else {
                        console.log('Successfully synced helper daily report to LB API');
                    }
                } catch (syncError) {
                    console.error('Error calling syncDailyReport API for helper:', syncError);
                }
            } else {
                // ✅ Ensure revision document exists (prevents phantom doc bug where getDocs returns empty)
                const revDocRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'revisions', currentRev);
                await setDoc(revDocRef, { revisionId: currentRev, projectId: taskDoc?.projectId || '', createdAt: new Date().toISOString() }, { merge: true });

                // Save daily report with date YYYY-MM-DD as document ID for LB compatibility
                const reportRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'revisions', currentRev, 'dailyReports', reportDate);
                await setDoc(reportRef, { ...finalReport, projectId: taskDoc?.projectId || '' });

                // Step 2: Trigger daily report sync API immediately after successful write
                try {
                    const reportPath = `workOrders/${workOrderId}/categories/${categoryId}/tasks/${parentTaskId}/subtasks/${subtaskId}/revisions/${currentRev}/dailyReports/${reportDate}`;
                    console.log('Syncing daily report to LB API...', { reportPath, reportDate });
                    const syncResponse = await fetch('https://asia-southeast1-after-sale-system.cloudfunctions.net/syncDailyReport', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            reportPath,
                            reportDate
                        })
                    });

                    if (!syncResponse.ok) {
                        console.error('Failed to sync daily report:', syncResponse.status, await syncResponse.text());
                    } else {
                        console.log('Successfully synced daily report to LB API');
                    }
                } catch (syncError) {
                    console.error('Error calling syncDailyReport API:', syncError);
                }
            }
        }

        const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId);
        
        if (taskDoc) {
            if (isHelperReport) {
                // Bypass progress/status updates, only update updatedAt on task doc
                await updateDoc(taskRef, {
                    updatedAt: new Date().toISOString()
                });
            } else {
                // A draft report (status: 'draft') is real progress data, but must NOT
                // flip the task to "For Checking"/stamp completedAt on its own — that
                // would surface the task for customer QR/delivery before the foreman
                // has actually finalized it (user-confirmed 2026-07-24). Reaching 100%
                // via a draft leaves the task's status/completedAt untouched; only a
                // status:'submitted' (or legacy, status-less) report can complete it.
                const isDraftReport = (report as any).status === 'draft';
                const isCompleted = !isDraftReport && (report.progress === 100 || (taskDoc.dailyProgress === 100));
                const newProgress = Math.max(taskDoc.dailyProgress || 0, report.progress || 0);
                const progressStatus = (report as any).status || 'submitted';

                // Single source of truth: store the new CamelCase task vocab directly (no LB translation).
                let lbStatus = isCompleted ? 'For Checking' : 'In Progress';

                const progressNow = new Date().toISOString();
                if (isWoaWop || isSubtask) {
                    await updateDoc(taskRef, {
                        dailyProgress: newProgress,
                        progressStatus,
                        ...(isDraftReport ? {} : { status: lbStatus }),
                        updatedAt: progressNow,
                        ...(isCompleted ? { completedAt: progressNow } : {})
                    });

                    // Update subtask as well
                    const subtaskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId);
                    await updateDoc(subtaskRef, {
                        dailyProgress: newProgress,
                        progressStatus,
                        ...(isDraftReport ? {} : { status: lbStatus })
                    });
                } else {
                    await updateDoc(taskRef, {
                        dailyProgress: newProgress,
                        progressStatus,
                        ...(isDraftReport ? {} : { status: isCompleted ? 'For Checking' : 'In Progress' }),
                        updatedAt: progressNow,
                        ...(isCompleted ? { completedAt: progressNow } : {})
                    });
                }
            }
        }
        // Recompute WO status from ALL its tasks (single source of truth).
        // Previously this only bumped lastUpdate — WO never advanced on daily-report progress (the core defect).
        const woStatus = await recomputeWoStatus(workOrderId);
        await updateDoc(doc(db, 'workOrders', workOrderId), { status: woStatus, lastUpdate: new Date().toISOString() });
    };

    const updateTask = async (workOrderId: string, categoryId: string, taskId: string, updates: Partial<MasterTask>) => {
        // Resolve parent/subtask ids structurally (labor principle) — no id-string slicing.
        const { parentTaskId, subtaskId, isSubtask } = resolveTaskRefs(allWorkOrders, workOrderId, categoryId, taskId);

        const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId);

        // Check if subtasks exist for this task in the database
        const subtasksRef = collection(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks');
        const subtasksSnap = await getDocs(subtasksRef);
        const hasSubtasks = !subtasksSnap.empty;

        const taskDocSnap = await getDoc(taskRef);
        if (!taskDocSnap.exists()) {
            await updateDoc(taskRef, updates);
            return;
        }

        const taskData = taskDocSnap.data();
        
        // Single source of truth: store the new CamelCase task vocab directly (no LB translation).
        const lbStatus = updates.status || taskData.status || 'Draft';

        // Resolve assignees if staff changed
        const resolvedAssignees = updates.responsibleStaffIds
            ? await resolveAssignees(updates.responsibleStaffIds)
            : undefined;

        if (isSubtask) {
            // Only update the subtask document and help/revisions
            const subtaskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId);
            const subtaskDocSnap = await getDoc(subtaskRef);
            const subtaskData = subtaskDocSnap.exists() ? subtaskDocSnap.data() : null;

            const currentRev = updates.currentRevision || subtaskData?.currentRevision || 'rev00';
            const revisionName = updates.revisionName || updates.notes || subtaskData?.revisionName || taskData?.revisionName || 'มาช่วยกันเร็ว';
            const taskName = subtaskData?.subtaskName || taskData?.taskName || taskData?.name || 'มาช่วยกันเร็ว';

            const helperAssignees = (updates.helperForemanIds || []).map((fid: string) => {
                const s = staff.find(x => x.id === fid || x.employeeId === fid);
                return {
                    employeeId: fid,
                    name: s ? s.name : '',
                    roleId: s ? (s.role === 'Admin' ? 'AM' : 'FM') : 'FM'
                };
            });

            const subtaskUpdates: any = {};
            if (updates.status) subtaskUpdates.status = lbStatus;
            if (updates.dailyProgress !== undefined) subtaskUpdates.dailyProgress = updates.dailyProgress;
            if (updates.currentRevision) subtaskUpdates.currentRevision = updates.currentRevision;
            if (updates.isSupportRequest !== undefined) subtaskUpdates.isSupportRequest = updates.isSupportRequest;
            if (updates.isPickedUpBySupport !== undefined) subtaskUpdates.isPickedUpBySupport = updates.isPickedUpBySupport;

            if (updates.isPickedUpBySupport === true) {
                subtaskUpdates.supportAssignees = helperAssignees;
                subtaskUpdates.supportTaskName = revisionName;
                subtaskUpdates.supportCreatedAt = new Date();
                subtaskUpdates.supportedRevisionIds = [currentRev];
            } else if (updates.isPickedUpBySupport === false) {
                subtaskUpdates.supportAssignees = [];
                subtaskUpdates.supportTaskName = '';
                subtaskUpdates.supportCreatedAt = null;
                subtaskUpdates.supportedRevisionIds = [];
            }
            
            // Note: do NOT update parent task doc at all for helper subtask edits!
            await updateDoc(subtaskRef, subtaskUpdates);
            
            // Revisions and Help subcollections updates:
            const revisionRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'revisions', currentRev);
            await setDoc(revisionRef, {
                revisionId: currentRev,
                revisionName: updates.revisionName || 'Revision',
                status: 'active',
                projectId: taskData?.projectId || '',
                createdAt: new Date().toISOString()
            }, { merge: true });

            if (updates.isPickedUpBySupport === true) {
                const helpId = currentRev.replace('rev', 'help');
                const helpDocRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'help', helpId);
                await setDoc(helpDocRef, {
                    revisionId: helpId,
                    revisionName: revisionName,
                    taskName: taskName,
                    assignees: helperAssignees,
                    projectId: taskData?.projectId || '',
                    createdAt: new Date(),
                    createdBy: user?.employeeId || user?.id || 'admin'
                });
            }
            await updateDoc(doc(db, 'workOrders', workOrderId), { lastUpdate: new Date().toISOString() });
            return;
        }

        // Apply updates to task document
        const mappedUpdates: any = { ...updates };
        // Stamp mutation metadata — stale-approve baseline (Workstream B) + audit trail (Workstream C)
        mappedUpdates.updatedAt = new Date().toISOString();
        mappedUpdates.updatedBy = user?.employeeId || user?.id || 'system';
        if (updates.name) mappedUpdates.taskName = updates.name;
        if (updates.status) mappedUpdates.status = lbStatus;
        if (updates.responsibleStaffIds && updates.responsibleStaffIds.length > 0) {
            mappedUpdates.subtaskOperatorId = updates.responsibleStaffIds[0];
            if (resolvedAssignees) {
                mappedUpdates.assignees = resolvedAssignees;
            }
        }

        await updateDoc(taskRef, mappedUpdates);

        // Workstream C: audit trail — record field-level before→after for this edit
        try {
            const changes = Object.keys(updates)
                .filter(k => JSON.stringify((taskData as any)[k]) !== JSON.stringify((updates as any)[k]))
                .map(k => ({ field: k, before: (taskData as any)[k] ?? null, after: (updates as any)[k] ?? null }));
            if (changes.length > 0) {
                logService.trackChange({
                    userId: user?.id || 'system',
                    userName: (user as any)?.name || user?.employeeId || 'system',
                    role: (user as any)?.role || 'Unknown',
                    module: 'WORK_ORDERS',
                    action: 'UPDATE',
                    targetId: `${workOrderId}/${parentTaskId}`,
                    changes
                });
            }
        } catch (e) {
            console.error('Audit log (updateTask) failed:', e);
        }

        // Identify which subtask IDs need to be updated. If subtasks exist in Firestore, update all of them!
        const subtaskIdsToUpdate: string[] = [];
        if (hasSubtasks) {
            subtasksSnap.docs.forEach(doc => {
                subtaskIdsToUpdate.push(doc.id);
            });
        } else {
            subtaskIdsToUpdate.push(getSubtaskId(taskId));
        }

        for (const subtaskId of subtaskIdsToUpdate) {
            const subtaskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId);
            const subtaskDocSnap = await getDoc(subtaskRef);
            const subtaskData = subtaskDocSnap.exists() ? subtaskDocSnap.data() : null;

            const currentRev = updates.currentRevision || subtaskData?.currentRevision || 'rev00';
            const revisionName = updates.revisionName || updates.notes || subtaskData?.revisionName || taskData?.revisionName || 'มาช่วยกันเร็ว';
            const taskName = subtaskData?.subtaskName || taskData?.taskName || taskData?.name || 'มาช่วยกันเร็ว';

            const helperAssignees = (updates.helperForemanIds || []).map((fid: string) => {
                const s = staff.find(x => x.id === fid || x.employeeId === fid);
                return {
                    employeeId: fid,
                    name: s ? s.name : '',
                    roleId: s ? (s.role === 'Admin' ? 'AM' : 'FM') : 'FM'
                };
            });

            const subtaskUpdates: any = {};
            if (updates.status) subtaskUpdates.status = lbStatus;
            if (updates.dailyProgress !== undefined) subtaskUpdates.dailyProgress = updates.dailyProgress;
            if (updates.currentRevision) subtaskUpdates.currentRevision = updates.currentRevision;
            if (updates.isSupportRequest !== undefined) subtaskUpdates.isSupportRequest = updates.isSupportRequest;
            if (updates.isPickedUpBySupport !== undefined) subtaskUpdates.isPickedUpBySupport = updates.isPickedUpBySupport;
            if (updates.responsibleStaffIds && updates.responsibleStaffIds.length > 0) {
                subtaskUpdates.subtaskOperatorId = updates.responsibleStaffIds[0];
                if (resolvedAssignees) {
                    subtaskUpdates.assignees = resolvedAssignees;
                }
            }

            if (updates.isPickedUpBySupport === true) {
                subtaskUpdates.supportAssignees = helperAssignees;
                subtaskUpdates.supportTaskName = revisionName;
                subtaskUpdates.supportCreatedAt = new Date();
                subtaskUpdates.supportedRevisionIds = [currentRev];
            } else if (updates.isPickedUpBySupport === false) {
                subtaskUpdates.supportAssignees = [];
                subtaskUpdates.supportTaskName = '';
                subtaskUpdates.supportCreatedAt = null;
                subtaskUpdates.supportedRevisionIds = [];
            }

            if (subtaskDocSnap.exists()) {
                await updateDoc(subtaskRef, subtaskUpdates);
            } else {
                // Write subtask if it doesn't exist
                const assignees = taskData.assignees || [];
                await setDoc(subtaskRef, {
                    subtaskId,
                    subtaskName: taskData.taskName || taskData.name || '',
                    status: lbStatus,
                    dailyProgress: updates.dailyProgress !== undefined ? updates.dailyProgress : (taskData.dailyProgress || 0),
                    assignees,
                    subtaskOperatorId: updates.responsibleStaffIds?.[0] || taskData.subtaskOperatorId || (taskData.responsibleStaffIds && taskData.responsibleStaffIds[0]) || "",
                    currentRevision: updates.currentRevision || taskData.currentRevision || 'rev00',
                    projectId: taskData.projectId || '',
                    isActive: true,
                    isSupportRequest: updates.isSupportRequest !== undefined ? updates.isSupportRequest : (taskData.isSupportRequest || false),
                    isPickedUpBySupport: updates.isPickedUpBySupport !== undefined ? updates.isPickedUpBySupport : (taskData.isPickedUpBySupport || false),
                    supportAssignees: updates.isPickedUpBySupport === true ? helperAssignees : [],
                    supportTaskName: updates.isPickedUpBySupport === true ? revisionName : '',
                    supportCreatedAt: updates.isPickedUpBySupport === true ? new Date() : null,
                    supportedRevisionIds: updates.isPickedUpBySupport === true ? [currentRev] : []
                });
            }

            // If currentRevision changed or we have updates like rejectReason/revisionName, write/update revision document
            const revisionRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'revisions', currentRev);
            const revisionData: any = {
                revisionId: currentRev,
                revisionName: updates.revisionName || updates.notes || subtaskData?.revisionName || taskData?.revisionName || 'Revision',
                status: 'active',
                projectId: taskData.projectId || '',
                createdAt: updates.revisionCreatedAt || taskData.revisionCreatedAt || new Date().toISOString()
            };
            await setDoc(revisionRef, revisionData, { merge: true });

            // If helper assigned, initialize/update help subcollection
            if (updates.isPickedUpBySupport === true) {
                const helpId = currentRev.replace('rev', 'help');
                const helpDocRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', parentTaskId, 'subtasks', subtaskId, 'help', helpId);
                await setDoc(helpDocRef, {
                    revisionId: helpId,
                    revisionName: revisionName,
                    taskName: taskName,
                    assignees: helperAssignees,
                    projectId: taskData.projectId || '',
                    createdAt: new Date(),
                    createdBy: user?.employeeId || user?.id || 'admin'
                });
            }
        }

        // Single source of truth: recompute WO status from ALL tasks after any task change.
        try {
            const woRef = doc(db, 'workOrders', workOrderId);
            const prevSnap = await getDoc(woRef);
            const prev = prevSnap.exists() ? prevSnap.data() : {};
            const woStatus = await recomputeWoStatus(workOrderId);
            const woUpdates: any = { status: woStatus, lastUpdate: new Date().toISOString() };
            // Leaving customer_reject (admin re-assigned, nothing left awaiting admin) → unlock foremen.
            if (prev.status === 'customer_reject' && woStatus !== 'customer_reject') {
                woUpdates.reviewedByAdmin = true;
                woUpdates.pendingAdminReassign = false; // admin has re-assigned, foremen unlocked
                woUpdates.reviewedAt = new Date().toISOString();
                woUpdates.adminReviewedAt = new Date().toISOString();
            }
            await updateDoc(woRef, woUpdates);
        } catch (err) {
            console.error("Failed to transition Work Order status in updateTask:", err);
        }
    };

    const updateWorkOrderStatus = async (id: string, status: WorkOrder['status']) => {
        await updateDoc(doc(db, 'workOrders', id), { status, lastUpdate: new Date().toISOString() });
    };

    const approvePreHandoverWO = async (
        woId: string,
        confirmedSla: string,
        assignments: { catId: string; foremanId: string; foremanName: string }[],
        scheduledDate: string
    ) => {
        // Read WO doc once for task/subtask fields
        const woSnap = await getDoc(doc(db, 'workOrders', woId));
        const woData = woSnap.data() || {};

        // Pre-fetch category names + foreman roleIds for WOA-matching assignees format
        const enriched = await Promise.all(assignments.map(async (a) => {
            const [catSnap, userSnap] = await Promise.all([
                getDoc(doc(db, 'workOrders', woId, 'categories', a.catId)),
                getDoc(doc(db, 'users', a.foremanId)),
            ]);
            const catData = catSnap.data() || {};
            const userData = userSnap.data() || {};
            return {
                ...a,
                catName: (catData as any).name || (catData as any).catName || a.catId,
                roleId: (userData as any).roleId || (userData as any).role || '',
                catDocuments: (catData as any).documents || [],
            };
        }));

        const batch = writeBatch(db);
        batch.update(doc(db, 'workOrders', woId), {
            status: 'In Progress',
            phActualSla: confirmedSla,
            scheduledDate,
            startDate: new Date().toISOString(),
            lastUpdate: new Date().toISOString(),
            reviewedByAdmin: true,
            adminReviewedAt: new Date().toISOString()
        });
        const firstCatId = enriched[0]?.catId;
        for (const a of enriched) {
            const taskId = a.catId;
            const subtaskId = a.catId.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
            const assignees = [{ employeeId: a.foremanId, name: a.foremanName, roleId: a.roleId }];
            const now = new Date().toISOString();

            // assignedForemanId/Name and currentRevision now live in task/subtask docs only (WOA-matching structure)

            // Task doc (WOA-matching) — documents stored in first category's task only
            const taskDocData: any = {
                taskId,
                taskName: a.catName,
                assignees,
                status: 'In Progress',
                workOrderId: woId,
                workOrderCode: (woData as any).workOrderCode || (woData as any).code || woId,
                workOrderName: (woData as any).locationName || (woData as any).projectName || '',
                categoryId: a.catId,
                categoryName: a.catName,
                projectId: (woData as any).projectId || '',
                isActive: true,
                isPreHandover: true,
                createdAt: now,
            };
            if (a.catId === firstCatId && a.catDocuments && a.catDocuments.length > 0) {
                taskDocData.documents = a.catDocuments;
            }
            batch.set(doc(db, 'workOrders', woId, 'categories', a.catId, 'tasks', taskId), taskDocData);

            // Subtask doc (WOA-matching)
            batch.set(doc(db, 'workOrders', woId, 'categories', a.catId, 'tasks', taskId, 'subtasks', subtaskId), {
                subtaskId,
                subtaskName: a.catName,
                assignees,
                status: 'In Progress',
                dailyProgress: 0,
                currentRevision: 'rev00',
                projectId: (woData as any).projectId || '',
                isActive: true,
                createdAt: now,
            });

            // Revision doc under subtask (WOA-matching path)
            batch.set(doc(db, 'workOrders', woId, 'categories', a.catId, 'tasks', taskId, 'subtasks', subtaskId, 'revisions', 'rev00'), {
                revisionId: 'rev00',
                revisionName: 'Initial Revision',
                status: 'active',
                projectId: (woData as any).projectId || '',
                createdAt: now,
            });
        }
        await batch.commit();
    };

    const submitRetroactiveRequest = async (
        workOrderId: string,
        categoryId: string,
        taskId: string,
        date: string,
        payload: { progress: number; note: string; type: string; labor: any[]; leave?: any[]; photos?: any },
        submittedBy: { uid: string; name: string }
    ) => {
        const requestsRef = collection(db, 'workOrders', workOrderId, 'retroactiveRequests');
        // Block duplicate pending for same task+date
        const existing = await getDocs(query(requestsRef,
            where('taskId', '==', taskId),
            where('requestDate', '==', date),
            where('status', '==', 'pending')
        ));
        if (!existing.empty) throw new Error('DUPLICATE_PENDING');

        const wo = allWorkOrders.find(w => w?.id === workOrderId);
        const cat = wo?.categories?.find((c: any) => c?.id === categoryId);
        const task = cat?.tasks?.find((t: any) => t?.id === taskId);

        await addDoc(requestsRef, {
            taskId,
            categoryId,
            requestDate: date,
            submittedBy,
            submittedAt: new Date().toISOString(),
            status: 'pending',
            payload,
            context: {
                woCode: wo?.id || workOrderId,
                projectName: wo?.projectName || '',
                locationName: wo?.locationName || '',
                taskName: task?.name || '',
                categoryName: cat?.name || '',
            },
        });
    };

    const approveRetroactiveRequest = async (
        requestId: string,
        workOrderId: string,
        approvedBy: { uid: string; name: string }
    ) => {
        const reqRef = doc(db, 'workOrders', workOrderId, 'retroactiveRequests', requestId);
        const reqSnap = await getDoc(reqRef);
        if (!reqSnap.exists()) throw new Error('REQUEST_NOT_FOUND');
        const req = reqSnap.data();
        if (req.status !== 'pending') throw new Error('REQUEST_NOT_PENDING');

        const { taskId, categoryId, requestDate, payload } = req;

        // Determine save path — same logic as addTaskUpdate
        const isWOA = isWoaWopType(allWorkOrders.find(w => w?.id === workOrderId));
        const now = new Date().toISOString();

        if (isWOA) {
            // Derive subtask ID the same way addTaskUpdate does
            const subtaskId = getSubtaskId(taskId);
            // Get currentRevision from allWorkOrders in-memory, fallback to Firestore
            const woMem = allWorkOrders.find(w => w?.id === workOrderId);
            const taskMem = woMem?.categories?.find((c: any) => c?.id === categoryId)?.tasks?.find((t: any) => t?.id === taskId);
            let currentRev = taskMem?.currentRevision || 'rev00';
            // If not in memory, fetch from Firestore
            if (!taskMem) {
                try {
                    const subtaskRef = collection(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'subtasks', subtaskId, 'revisions');
                    const revSnap = await getDocs(subtaskRef);
                    if (!revSnap.empty) {
                        const activeRev = revSnap.docs.find(d => d.data().status === 'active') || revSnap.docs.sort((a, b) => b.id.localeCompare(a.id))[0];
                        if (activeRev) currentRev = activeRev.id;
                    }
                } catch (_) {}
            }
            const reportRef = doc(db,
                'workOrders', workOrderId,
                'categories', categoryId,
                'tasks', taskId,
                'subtasks', subtaskId,
                'revisions', currentRev,
                'dailyReports', requestDate
            );
            // Read the parent task doc first (tasks always carry projectId) so the new
            // dailyReports doc can be stamped with it too.
            const taskRefWoa = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId);
            const taskSnapWoa = await getDoc(taskRefWoa);
            const taskProjectId = taskSnapWoa.exists() ? (taskSnapWoa.data() as any).projectId || '' : '';
            await setDoc(reportRef, {
                ...payload,
                id: requestDate,
                date: `${requestDate}T08:00:00.000Z`,
                createdBy: req.submittedBy.uid,
                createdAt: req.submittedAt,
                updatedBy: approvedBy.uid,
                updatedAt: now,
                serverTimestamp: now,
                approvedBy: approvedBy.uid,
                approvedAt: now,
                isRetroactive: true,
                projectId: taskProjectId,
            }, { merge: true });
            // Mirror the canonical WOA submit (addTaskUpdate ~:924-953) and the WOP
            // retroactive path (approvePhRetroactiveRequest ~:1500-1504): an approved
            // retroactive request IS a real submission, so stamp progressStatus:'submitted'
            // (+ status/completedAt) on BOTH task and subtask, then recompute the WO.
            // Previously this wrote only dailyProgress, leaving progressStatus at 'draft',
            // so the handover QR never appeared (the reported bug). (T-335 re-fetch note:
            // the collectionGroup delta cache refreshes directly; this write carries real
            // progress data, so it stays — now with the full submitted-completion state.)
            const isCompletedRetro = payload.progress === 100;
            const progressUpdateRetro: any = {
                dailyProgress: payload.progress,
                progressStatus: 'submitted',
                status: isCompletedRetro ? 'For Checking' : 'In Progress',
                updatedAt: now,
                ...(isCompletedRetro ? { completedAt: now } : {}),
            };
            const subtaskRefWoa = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'subtasks', subtaskId);
            await Promise.all([
                updateDoc(taskRefWoa, progressUpdateRetro),
                updateDoc(subtaskRefWoa, progressUpdateRetro),
            ]);
            const woStatusRetro = await recomputeWoStatus(workOrderId);
            await updateDoc(doc(db, 'workOrders', workOrderId), { status: woStatusRetro, lastUpdate: now });
        } else {
            const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId);
            const taskSnap = await getDoc(taskRef);
            const existing = taskSnap.data();
            const history: any[] = existing?.history || [];
            const idx = history.findIndex((h: any) => h.date?.startsWith(requestDate));
            const entry = {
                ...payload,
                id: requestDate,
                date: `${requestDate}T08:00:00.000Z`,
                createdBy: req.submittedBy.uid,
                createdAt: req.submittedAt,
                updatedBy: approvedBy.uid,
                updatedAt: now,
                serverTimestamp: now,
                approvedBy: approvedBy.uid,
                approvedAt: now,
                isRetroactive: true,
            };
            if (idx >= 0) history[idx] = entry;
            else history.push(entry);
            await updateDoc(taskRef, { history, dailyProgress: payload.progress, updatedAt: now });
        }

        await updateDoc(reqRef, {
            status: 'approved',
            approvedBy,
            resolvedAt: now,
        });

        // Delete the pending draft so form clears after approval
        try {
            const draftSubId = getSubtaskId(taskId);
            const woMem2 = allWorkOrders.find(w => w?.id === workOrderId);
            const taskMem2 = woMem2?.categories?.find((c: any) => c?.id === categoryId)?.tasks?.find((t: any) => t?.id === taskId);
            const draftRev = taskMem2?.currentRevision || 'rev00';
            const draftRef = isWOA
                ? doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'subtasks', draftSubId, 'revisions', draftRev, 'dailyReportsDraft', requestDate)
                : doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'dailyreportDraft', requestDate);
            await deleteDoc(draftRef);
        } catch (_) {}
    };

    const approvePhRetroactiveRequest = async (
        woId: string,
        catId: string,
        requestDate: string,
        approvedBy: { uid: string; name: string }
    ) => {
        const now = new Date().toISOString();
        const reqRef = doc(db, 'workOrders', woId, 'categories', catId, 'phRetroactiveRequests', requestDate);
        const reqSnap = await getDoc(reqRef);
        if (!reqSnap.exists()) throw new Error('REQUEST_NOT_FOUND');
        const req: any = reqSnap.data();
        if (req.status !== 'pending') throw new Error('REQUEST_NOT_PENDING');

        const catRef = doc(db, 'workOrders', woId, 'categories', catId);
        const catSnap = await getDoc(catRef);
        const catData: any = catSnap.data() || {};
        const woSnap = await getDoc(doc(db, 'workOrders', woId));
        const woData: any = woSnap.exists() ? woSnap.data() : {};

        if (req.payload) {
            // Request already carries the full report (captured at submit time,
            // 2026-08-04 fix) — write it straight into the real dailyReports doc
            // on approval, same as WOA's approveRetroactiveRequest, so the foreman
            // doesn't have to come back and re-enter the report after approval.
            const currentRev = catData.currentRevision || 'rev00';
            const phTaskId = catId;
            const phSubtaskId = catId.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
            const taskRef = doc(db, 'workOrders', woId, 'categories', catId, 'tasks', phTaskId);
            const subtaskRef = doc(taskRef, 'subtasks', phSubtaskId);
            const reportRef = doc(subtaskRef, 'revisions', currentRev, 'dailyReports', requestDate);
            await setDoc(reportRef, {
                ...req.payload,
                id: requestDate,
                date: requestDate,
                createdBy: req.requestedById,
                createdAt: req.requestedAt,
                updatedBy: approvedBy.uid,
                updatedAt: now,
                revisionId: currentRev,
                revisionName: currentRev === 'rev00' ? 'Initial Revision' : `Revision ${currentRev}`,
                status: 'submitted',
                projectId: woData.projectId || '',
                approvedBy: approvedBy.uid,
                approvedAt: now,
                isRetroactive: true,
            }, { merge: true });
            const progressUpdate = { dailyProgress: req.payload.progress, progressStatus: 'submitted', lastProgressUpdate: now };
            await Promise.all([
                updateDoc(subtaskRef, progressUpdate),
                updateDoc(taskRef, progressUpdate),
            ]);
            // Same sync call submitPhDailyReport makes on a normal submit —
            // without it this report would never produce a DailyEmployeeTimesheets
            // record (the same class of gap fixed for the direct-submit path).
            try {
                const reportPath = `workOrders/${woId}/categories/${catId}/tasks/${phTaskId}/subtasks/${phSubtaskId}/revisions/${currentRev}/dailyReports/${requestDate}`;
                const syncResponse = await fetch('https://asia-southeast1-after-sale-system.cloudfunctions.net/syncDailyReport', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reportPath, reportDate: requestDate }),
                });
                if (!syncResponse.ok) {
                    console.error('Failed to sync approved WOP retroactive report:', syncResponse.status, await syncResponse.text());
                }
            } catch (syncError) {
                console.error('Error calling syncDailyReport API for approved WOP retroactive report:', syncError);
            }
            try {
                await deleteDoc(doc(subtaskRef, 'revisions', currentRev, 'dailyReportsDraft', requestDate));
            } catch (_) {}
        } else {
            // Legacy request submitted before payload-capture existed — fall back
            // to the old unlock-only behavior so an already-pending request isn't
            // broken by this fix.
            const phUnlockedDates = catData.phUnlockedDates || {};
            phUnlockedDates[requestDate] = {
                unlockedUntil: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                approvedBy: approvedBy.uid,
                approvedAt: now,
            };
            await updateDoc(catRef, { phUnlockedDates });
        }

        await updateDoc(reqRef, { status: 'approved', approvedBy, resolvedAt: now });
    };

    const rejectPhRetroactiveRequest = async (
        woId: string,
        catId: string,
        requestDate: string,
        rejectedBy: { uid: string; name: string },
        reason: string
    ) => {
        const now = new Date().toISOString();
        const reqRef = doc(db, 'workOrders', woId, 'categories', catId, 'phRetroactiveRequests', requestDate);
        await updateDoc(reqRef, { status: 'rejected', rejectedBy, rejectReason: reason, resolvedAt: now });
    };

    const rejectRetroactiveRequest = async (
        requestId: string,
        workOrderId: string,
        rejectedBy: { uid: string; name: string },
        reason: string
    ) => {
        const reqRef = doc(db, 'workOrders', workOrderId, 'retroactiveRequests', requestId);
        const reqSnap = await getDoc(reqRef);
        const reqData = reqSnap.exists() ? reqSnap.data() : null;
        await updateDoc(reqRef, {
            status: 'rejected',
            rejectedBy,
            rejectedReason: reason,
            resolvedAt: new Date().toISOString(),
        });

        // Clear isPendingRetroactive flag from draft so foreman can resubmit
        if (reqData) {
            try {
                const { taskId, categoryId, requestDate } = reqData;
                const isWoaRej = isWoaWopType(allWorkOrders.find(w => w?.id === workOrderId));
                const subIdRej = getSubtaskId(taskId);
                const taskMemRej = allWorkOrders.find(w => w?.id === workOrderId)?.categories?.find((c: any) => c?.id === categoryId)?.tasks?.find((t: any) => t?.id === taskId);
                const revRej = taskMemRej?.currentRevision || 'rev00';
                const draftRefRej = isWoaRej
                    ? doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'subtasks', subIdRej, 'revisions', revRej, 'dailyReportsDraft', requestDate)
                    : doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'dailyreportDraft', requestDate);
                await updateDoc(draftRefRej, { isPendingRetroactive: false });
            } catch (_) {}
        }
    };

    const requestRetroactiveUnlock = async (workOrderId: string, categoryId: string, taskId: string, date: string, reason: string) => {
        const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId);
        const taskDoc = allWorkOrders.find(w => w?.id === workOrderId)?.categories?.find(c => c?.id === categoryId)?.tasks?.find(t => t?.id === taskId);
        
        // For demonstration, we auto-approve the unlock for 24 hours.
        // In a full implementation, this would send a notification to the Admin and wait for approval.
        const unlockedDates = taskDoc?.unlockedDates || {};
        unlockedDates[date] = {
            unlockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
            reason: reason
        };

        await updateDoc(taskRef, {
            unlockedDates
        });
    };

    const logCustomerQrView = async (woId: string) => {
        try {
            const woRef = doc(db, 'workOrders', woId);
            const woSnap = await getDoc(woRef);
            if (woSnap.exists()) {
                const data = woSnap.data();
                if (!data.inspectionTimeline || !data.inspectionTimeline.qrOpenedAt) {
                    const now = new Date().toISOString();
                    await updateDoc(woRef, {
                        'inspectionTimeline.qrOpenedAt': now,
                        lastUpdate: now
                    });
                    console.log('Customer scanned/opened QR link successfully logged:', now);
                }
            }
        } catch (err) {
            console.error('Failed to log customer QR view:', err);
        }
    };

    const generateDeliveryQrToken = async (woId: string, ownerId: string) => {
        // Generate secure random token
        const array = new Uint32Array(4);
        window.crypto.getRandomValues(array);
        const token = Array.from(array, dec => dec.toString(16).padStart(8, '0')).join('');
        
        const now = new Date().toISOString();
        // Live tasks move to pending_delivery so the WO status derives purely from tasks.
        // Cancelled / archived-rejected tasks are already closed — skip them, or this
        // resurrects them as a live "pending_delivery" task (wrong % + reappears in lists).
        const catsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories'));
        for (const catDoc of catsSnap.docs) {
            const tSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks'));
            for (const tDoc of tSnap.docs) {
                const tData = tDoc.data();
                if (tData.status === 'Cancelled' || (tData.status === 'Rejected' && tData.taskArchived === true)) continue;
                await updateDoc(tDoc.ref, { status: 'pending_delivery', updatedAt: now });
            }
        }
        const woStatus = await recomputeWoStatus(woId);
        await updateDoc(doc(db, 'workOrders', woId), {
            status: woStatus,
            woOwnerId: ownerId,
            deliveryQrToken: token,
            'inspectionTimeline.qrGeneratedAt': now,
            lastUpdate: now
        });

        return token;
    };

    const submitCustomerInspection = async (
        woId: string, 
        approvals: Record<string, { 
            status: 'approved' | 'rejected'; 
            reason?: string; 
            defectCategories?: Record<string, boolean>;
            contactName?: string;
            contactPhone?: string;
        }>,
        survey?: {
            workQuality: number;
            siteCleanliness: number;
            foremanProfessionalism: number;
            specAccuracy: number;
            handoverCare: number;
        }
    ) => {
        const woRef = doc(db, 'workOrders', woId);
        const woSnap = await getDoc(woRef);
        if (!woSnap.exists()) throw new Error('Work Order not found');
        const woData = woSnap.data() || {};

        const now = new Date().toISOString();
        
        let hasRejections = false;
        const rejectedTaskNames: string[] = [];
        
        // Loop through categories and tasks to apply customer decision
        const categoriesSnap = await getDocs(collection(db, 'workOrders', woId, 'categories'));
        for (const catDoc of categoriesSnap.docs) {
            const tasksSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks'));
            for (const taskDoc of tasksSnap.docs) {
                const taskData = taskDoc.data();
                const taskId = taskDoc.id;
                const decision = approvals[taskId];
                
                if (!decision) continue; // Skip if no decision for this task

                const subtaskId = getSubtaskId(taskId);
                const subtaskRef = doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskId);
                const currentRev = taskData.currentRevision || 'rev00';
                
                if (decision.status === 'approved') {
                    // Update task to Verified / completed
                    await updateDoc(doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId), {
                        status: 'Complete', // customer approved → process done
                        customerApprovedAt: now,
                        updatedAt: now
                    });
                    await setDoc(subtaskRef, {
                        status: 'Complete',
                        customerApprovedAt: now
                    }, { merge: true });
                    
                    // Close the current active revision
                    const revisionRef = doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskId, 'revisions', currentRev);
                    await setDoc(revisionRef, {
                        status: 'closed_approved',
                        approvedAt: now,
                        projectId: taskData.projectId || ''
                    }, { merge: true });

                    // Send notification to the foreman responsible for this task
                    try {
                        const foremanId = taskData.subtaskOperatorId || (taskData.responsibleStaffIds && taskData.responsibleStaffIds[0]) || woData.woOwnerId || woData.reporterId || 'unknown';
                        if (foremanId && foremanId !== 'unknown') {
                            await addDoc(collection(db, 'notifications'), {
                                recipientId: foremanId,
                                senderId: 'customer',
                                senderName: 'ลูกค้า',
                                title: 'งานได้รับการอนุมัติจากลูกค้า',
                                message: `งาน "${taskData.taskName || taskData.name || taskId}" (ใบงาน ${woId}) ได้รับการอนุมัติผ่านจากลูกค้าเรียบร้อยแล้ว`,
                                type: 'success',
                                targetPath: `/daily-report?id=${woId}`,
                                isRead: false,
                                createdAt: serverTimestamp()
                            });
                        }
                    } catch (notifyErr) {
                        console.error("Failed to send approval notification to foreman:", notifyErr);
                    }
                } else if (decision.status === 'rejected') {
                    hasRejections = true;
                    rejectedTaskNames.push(taskData.taskName || taskData.name || taskId);
                    
                    // Close current revision as rejected
                    const currentRevisionRef = doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskId, 'revisions', currentRev);
                    await setDoc(currentRevisionRef, {
                        status: 'closed_rejected',
                        rejectReason: decision.reason || '',
                        defectCategories: decision.defectCategories || {},
                        contactName: decision.contactName || '',
                        contactPhone: decision.contactPhone || '',
                        rejectedAt: now,
                        projectId: taskData.projectId || ''
                    }, { merge: true });
                    
                    // Increment revision number
                    const revNum = parseInt(currentRev.replace('rev', '')) || 0;
                    const nextRev = `rev${String(revNum + 1).padStart(2, '0')}`;
                    
                    // Clean task name of any existing (REV. X) suffix
                    const cleanName = (taskData.taskName || taskData.name || '').replace(/\s*\(REV\.\s*\d+\)/gi, '').trim();
                    
                    // Default assignee is the Work Order Owner Foreman!
                    const ownerId = woData.woOwnerId || woData.reporterId || 'unknown';
                    const assignees = await resolveAssignees([ownerId]);

                    await updateDoc(doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId), {
                        status: 'Evaluating', // customer-rejected → back to admin re-eval (currentRevision bumped below)
                        dailyProgress: 0,
                        currentRevision: nextRev,
                        taskName: cleanName,
                        name: cleanName,
                        rejectReason: decision.reason || '',
                        contactName: decision.contactName || '',
                        contactPhone: decision.contactPhone || '',
                        revisionCreatedAt: now,
                        responsibleStaffIds: [ownerId],
                        assignees: assignees,
                        subtaskOperatorId: ownerId,
                        completedAt: deleteField(), // clear stale Round N timestamp so Round N+1 SLA calculates correctly
                        updatedAt: now
                    });
                    
                    await setDoc(subtaskRef, {
                        status: 'Evaluating',
                        dailyProgress: 0,
                        currentRevision: nextRev,
                        assignees: assignees,
                        subtaskOperatorId: ownerId
                    }, { merge: true });
                    
                    // Create new revision doc
                    const newRevisionRef = doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskId, 'subtasks', subtaskId, 'revisions', nextRev);
                    await setDoc(newRevisionRef, {
                        revisionId: nextRev,
                        revisionName: `Revision ${revNum + 1}`,
                        status: 'active',
                        createdAt: now,
                        projectId: taskData.projectId || ''
                    });
                    
                    // Send notification to the foreman originally assigned (or the WO owner foreman who will re-do it)
                    try {
                        const origForemanId = taskData.subtaskOperatorId || (taskData.responsibleStaffIds && taskData.responsibleStaffIds[0]) || ownerId;
                        if (origForemanId && origForemanId !== 'unknown') {
                            await addDoc(collection(db, 'notifications'), {
                                recipientId: origForemanId,
                                senderId: 'customer',
                                senderName: 'ลูกค้า',
                                title: 'งานถูกปฏิเสธโดยลูกค้า',
                                message: `งาน "${cleanName}" (ใบงาน ${woId}) ถูกปฏิเสธจากลูกค้า: ${decision.reason || 'กรุณาตรวจสอบและแก้ไข'}`,
                                type: 'error',
                                targetPath: `/daily-report?id=${woId}`,
                                isRead: false,
                                createdAt: serverTimestamp()
                            });
                        }
                    } catch (notifyErr) {
                        console.error("Failed to send reject notification to foreman:", notifyErr);
                    }
                    
                    // IMPORTANT: Do NOT clone labor records or daily reports into the new revision!
                    // This satisfies the constraint to start the new revision from a clean slate.
                }
            }
        }
        
        // Update root WO Document
        const woUpdates: any = {
            'inspectionTimeline.inspectionSubmittedAt': now,
            lastUpdate: now,
            // Customer inspection outcome leaves the admin-eval window entirely → never leave an eval lock hanging.
            evalLocked: false,
            evalLockedBy: ''
        };
        
        if (hasRejections) {
            woUpdates.status = 'customer_reject'; // distinct from admin-eval 'Rejected' (who ended it matters)
            woUpdates.reviewedByAdmin = false;
            woUpdates.pendingAdminReassign = true; // gate: foremen locked until admin re-assigns

            // Send notification to Admins
            try {
                await addDoc(collection(db, 'notifications'), {
                    recipientRole: 'Admin',
                    senderId: 'customer',
                    senderName: 'ลูกค้า',
                    title: 'ใบงานถูกปฏิเสธโดยลูกค้า',
                    message: `ใบงาน ${woId} ถูกปฏิเสธในรายการ: ${rejectedTaskNames.join(', ')}`,
                    type: 'error',
                    targetPath: `/evaluation`,
                    isRead: false,
                    createdAt: serverTimestamp()
                });
            } catch (notifyErr) {
                console.error("Failed to send reject notification to admin:", notifyErr);
            }
        } else {
            woUpdates.status = 'Complete';
            woUpdates.completedAt = now;
            if (survey) {
                woUpdates.satisfactionSurvey = {
                    ...survey,
                    submittedAt: now
                };
            }

            // Send notification to Admins for successful completion
            try {
                await addDoc(collection(db, 'notifications'), {
                    recipientRole: 'Admin',
                    senderId: 'customer',
                    senderName: 'ลูกค้า',
                    title: 'ใบงานได้รับการอนุมัติ (สำเร็จ)',
                    message: `ใบงาน ${woId} ได้รับการตรวจสอบและอนุมัติผ่านจากลูกค้าเรียบร้อยแล้ว`,
                    type: 'success',
                    targetPath: `/evaluation`,
                    isRead: false,
                    createdAt: serverTimestamp()
                });
            } catch (notifyErr) {
                console.error("Failed to send approval notification to admin:", notifyErr);
            }
        }
        
        await updateDoc(woRef, woUpdates);
    };

    const submitPhCustomerInspection = async (
        woId: string,
        catApprovals: Record<string, { status: 'approved' | 'rejected'; reason?: string }>,
        survey?: { workQuality: number; siteCleanliness: number; foremanProfessionalism: number; specAccuracy: number; handoverCare: number }
    ) => {
        const woRef = doc(db, 'workOrders', woId);
        const woSnap = await getDoc(woRef);
        if (!woSnap.exists()) throw new Error('Work Order not found');
        const woData: any = woSnap.data() || {};
        const now = new Date().toISOString();
        let hasRejections = false;
        const rejectedCatNames: string[] = [];

        const categoriesSnap = await getDocs(collection(db, 'workOrders', woId, 'categories'));
        for (const catDoc of categoriesSnap.docs) {
            const catData = catDoc.data();
            const decision = catApprovals[catDoc.id];
            if (!decision) continue;
            if (decision.status === 'approved') {
                const currentRev = catData.currentRevision || 'rev00';
                const phTaskId = catDoc.id;
                const phSubtaskId = catDoc.id.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
                await setDoc(doc(db, 'workOrders', woId, 'categories', catDoc.id, 'revisions', currentRev), {
                    status: 'closed_approved', approvedAt: now, projectId: woData.projectId || ''
                }, { merge: true });
                // Mirror to tasks/subtasks path (WOA-matching)
                await setDoc(doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', phTaskId, 'subtasks', phSubtaskId, 'revisions', currentRev), {
                    status: 'closed_approved', approvedAt: now, projectId: woData.projectId || ''
                }, { merge: true });
                await updateDoc(doc(db, 'workOrders', woId, 'categories', catDoc.id), {
                    customerStatus: 'approved', customerApprovedAt: now,
                });
                try {
                    if (catData.assignedForemanId) {
                        await addDoc(collection(db, 'notifications'), {
                            recipientId: catData.assignedForemanId, senderId: 'customer', senderName: 'ลูกค้า',
                            title: 'งานตรวจรับก่อนโอน — ผ่านแล้ว',
                            message: `หมวดงาน "${catData.name || catDoc.id}" (ใบงาน ${woId}) ได้รับการอนุมัติจากลูกค้าเรียบร้อยแล้ว`,
                            type: 'success', targetPath: `/daily-report?id=${woId}`, isRead: false, createdAt: serverTimestamp()
                        });
                    }
                } catch (_) {}
            } else {
                hasRejections = true;
                rejectedCatNames.push(catData.name || catDoc.id);
                const currentRev = catData.currentRevision || 'rev00';
                const revNum = parseInt(currentRev.replace('rev', '')) || 0;
                const nextRev = `rev${String(revNum + 1).padStart(2, '0')}`;
                const phTaskId = catDoc.id;
                const phSubtaskId = catDoc.id.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
                const subtaskRef = doc(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', phTaskId, 'subtasks', phSubtaskId);
                await setDoc(doc(db, 'workOrders', woId, 'categories', catDoc.id, 'revisions', currentRev), {
                    status: 'closed_rejected', rejectReason: decision.reason || '', rejectedAt: now, projectId: woData.projectId || ''
                }, { merge: true });
                await setDoc(doc(db, 'workOrders', woId, 'categories', catDoc.id, 'revisions', nextRev), {
                    revisionId: nextRev, status: 'active', createdAt: now, projectId: woData.projectId || ''
                });
                // Mirror to tasks/subtasks path (WOA-matching)
                await setDoc(doc(subtaskRef, 'revisions', currentRev), {
                    status: 'closed_rejected', rejectReason: decision.reason || '', rejectedAt: now, projectId: woData.projectId || ''
                }, { merge: true });
                await setDoc(doc(subtaskRef, 'revisions', nextRev), {
                    revisionId: nextRev, revisionName: `Revision ${nextRev}`, status: 'active', createdAt: now, projectId: woData.projectId || ''
                });
                await updateDoc(subtaskRef, {
                    currentRevision: nextRev,
                    dailyProgress: 0,
                    lastProgressUpdate: now,
                });
                await updateDoc(doc(db, 'workOrders', woId, 'categories', catDoc.id), {
                    customerStatus: 'rejected', customerRejectedAt: now, customerRejectReason: decision.reason || '',
                    dailyProgress: 0, lastProgressUpdate: now,
                    currentRevision: nextRev,
                });
                try {
                    if (catData.assignedForemanId) {
                        await addDoc(collection(db, 'notifications'), {
                            recipientId: catData.assignedForemanId, senderId: 'customer', senderName: 'ลูกค้า',
                            title: 'งานตรวจรับก่อนโอน — ถูกปฏิเสธ',
                            message: `หมวดงาน "${catData.name || catDoc.id}" (ใบงาน ${woId}) ถูกปฏิเสธจากลูกค้า: ${decision.reason || 'กรุณาตรวจสอบและแก้ไข'}`,
                            type: 'error', targetPath: `/daily-report?id=${woId}`, isRead: false, createdAt: serverTimestamp()
                        });
                    }
                } catch (_) {}
            }
        }

        const woUpdates: any = { 'inspectionTimeline.inspectionSubmittedAt': now, lastUpdate: now };
        if (hasRejections) {
            woUpdates.status = 'customer_reject'; // match WOA's submitCustomerInspection status value
            woUpdates.reviewedByAdmin = false;
            woUpdates.pendingAdminReassign = true;
            try {
                await addDoc(collection(db, 'notifications'), {
                    recipientRole: 'Admin', senderId: 'customer', senderName: 'ลูกค้า',
                    title: 'ใบงานก่อนโอนถูกปฏิเสธโดยลูกค้า',
                    message: `ใบงาน ${woId} ถูกปฏิเสธในหมวดงาน: ${rejectedCatNames.join(', ')}`,
                    type: 'error', targetPath: `/evaluation`, isRead: false, createdAt: serverTimestamp()
                });
            } catch (_) {}
        } else {
            woUpdates.status = 'Complete';
            woUpdates.completedAt = now;
            if (survey) woUpdates.satisfactionSurvey = { ...survey, submittedAt: now };
            try {
                await addDoc(collection(db, 'notifications'), {
                    recipientRole: 'Admin', senderId: 'customer', senderName: 'ลูกค้า',
                    title: 'ใบงานก่อนโอนได้รับการอนุมัติ',
                    message: `ใบงาน ${woId} ตรวจรับก่อนโอนเรียบร้อยแล้ว`,
                    type: 'success', targetPath: `/evaluation`, isRead: false, createdAt: serverTimestamp()
                });
            } catch (_) {}
        }
        await updateDoc(woRef, woUpdates);
    };

    const reviewRejectedPhWO = async (woId: string, newScheduledDate?: string, slaCategory?: string, foremanId?: string) => {
        const now = new Date().toISOString();
        const updates: any = {
            status: 'In Progress',
            reviewedByAdmin: true,
            pendingAdminReassign: false,
            adminReviewedAt: now,
            lastUpdate: now,
        };
        if (newScheduledDate) updates.scheduledDate = newScheduledDate;
        if (slaCategory) updates.phActualSla = slaCategory;
        updates.deliveryQrToken = null;
        updates.deliveryQrGeneratedAt = null;
        await updateDoc(doc(db, 'workOrders', woId), updates);

        const catsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories'));
        for (const catDoc of catsSnap.docs) {
            const catData = catDoc.data();
            if (catData.customerStatus !== 'rejected') continue;
            const catUpdates: any = { customerStatus: 'reassigned', reassignedAt: now, dailyProgress: 0 };
            const notifyTarget = foremanId || catData.assignedForemanId;
            if (foremanId) catUpdates.assignedForemanId = foremanId;
            if (slaCategory) catUpdates.slaCategory = slaCategory;
            await updateDoc(catDoc.ref, catUpdates);
            if (notifyTarget) {
                try {
                    await addDoc(collection(db, 'notifications'), {
                        recipientId: notifyTarget, senderId: 'admin', senderName: 'ผู้ดูแลระบบ',
                        title: 'งานตรวจรับก่อนโอน — รอดำเนินการแก้ไข',
                        message: `หมวดงาน "${catData.name || catDoc.id}" (ใบงาน ${woId}) ได้รับอนุมัติให้แก้ไขใหม่${newScheduledDate ? ` กำหนดการ: ${newScheduledDate}` : ''}`,
                        type: 'warning', targetPath: `/daily-report?id=${woId}`, isRead: false, createdAt: serverTimestamp()
                    });
                } catch (_) {}
            }
        }
    };

    // Single source of truth: recompute a WO's status from ALL its tasks (never stamped by hand).
    const recomputeWoStatus = async (woId: string): Promise<WorkOrder['status']> => {
        const catsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories'));
        const tasks: MasterTask[] = [];
        for (const catDoc of catsSnap.docs) {
            const tSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks'));
            tSnap.forEach(d => tasks.push({ ...(d.data() as any), id: d.id }));
        }
        return deriveWoStatus(tasks);
    };

    // FM cancels a task the admin already Rejected: keep status='Rejected' + mark taskArchived=true
    // (preserves history/audit trail — see deriveWoStatus's isClosed rule) instead of deleting it.
    // Immediate write — no separate FM submit step needed to persist the cancellation.
    const cancelRejectedTask = async (workOrderId: string, categoryId: string, taskId: string) => {
        const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId);
        await updateDoc(taskRef, {
            taskArchived: true,
            updatedAt: new Date().toISOString(),
            updatedBy: user?.employeeId || user?.id || 'system'
        });
        const woStatus = await recomputeWoStatus(workOrderId);
        await updateDoc(doc(db, 'workOrders', workOrderId), { status: woStatus, lastUpdate: new Date().toISOString() });
    };

    const deleteWorkOrder = async (id: string) => {
        // Eval-lock guard: FM delete blocked while an admin has the WO open for evaluation (evalLocked).
        await assertNotEvalLocked(id);
        // Cancel: WO + every task → 'Cancelled' + archived (Step 1b — allowed only before any task decided).
        const catsSnap = await getDocs(collection(db, 'workOrders', id, 'categories'));
        for (const catDoc of catsSnap.docs) {
            const tSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks'));
            for (const tDoc of tSnap.docs) {
                await updateDoc(tDoc.ref, { status: 'Cancelled', updatedAt: new Date().toISOString() });
            }
        }
        await updateDoc(doc(db, 'workOrders', id), { status: 'Cancelled', isArchived: true });
    };

    const archiveWorkOrder = async (id: string) => {
        await updateDoc(doc(db, 'workOrders', id), { isArchived: true });
    };

    const markWorkOrderAsReviewed = async (id: string) => {
        try {
            await updateDoc(doc(db, 'workOrders', id), { 
                reviewedByAdmin: true,
                pendingAdminReassign: false,
                reviewedAt: new Date().toISOString(),
                adminReviewedAt: new Date().toISOString()
            });
        } catch (err) {
            console.error("Failed to mark as reviewed:", err);
        }
    };

    const markWorkOrderAsOpenedByAdmin = async (id: string) => {
        try {
            const woRef = doc(db, 'workOrders', id);
            const woSnap = await getDoc(woRef);
            if (woSnap.exists()) {
                const data = woSnap.data();
                const openUpdates: any = {};
                // Pessimistic lock: opening a WO that is still under admin evaluation locks
                // editing (for foremen) until the admin makes a decision. Reject reopens editing;
                // approve advances the status out of 'Evaluating' so the lock stops applying.
                if (data.status === 'Evaluating') {
                    openUpdates.evalLocked = true;
                    openUpdates.evalLockedBy = user?.name || (user as any)?.employeeId || user?.id || '';
                }
                // adminReviewedAt keeps its "first-opened" meaning (set once) — powers the FM card badge.
                if (!data.adminReviewedAt) {
                    openUpdates.adminReviewedAt = new Date().toISOString();
                    openUpdates.lastUpdate = new Date().toISOString();
                }
                if (Object.keys(openUpdates).length > 0) {
                    await updateDoc(woRef, openUpdates);
                }
            }
        } catch (err) {
            console.error("Failed to mark work order as opened by admin:", err);
        }
    };

    const requestSupport = async (workOrderId: string, categoryId: string, taskId: string) => {
        try {
            const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId);
            await updateDoc(taskRef, {
                isSupportRequest: true,
                isPickedUpBySupport: false
            });

            const subtaskId = getSubtaskId(taskId);
            const subtaskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'subtasks', subtaskId);
            const subtaskSnap = await getDoc(subtaskRef);
            if (subtaskSnap.exists()) {
                await updateDoc(subtaskRef, {
                    isSupportRequest: true,
                    isPickedUpBySupport: false
                });
            }
        } catch (err) {
            console.error("Failed to request support:", err);
            throw err;
        }
    };

    const stable = useStableCallbacks({
        getWorkOrderById,
        updateTask,
        cancelRejectedTask,
        addWorkOrder,
        updateWorkOrderStatus,
        approvePreHandoverWO,
        saveEvaluation,
        addTaskUpdate,
        deleteWorkOrder,
        archiveWorkOrder,
        markWorkOrderAsReviewed,
        requestRetroactiveUnlock,
        submitRetroactiveRequest,
        approveRetroactiveRequest,
        rejectRetroactiveRequest,
        approvePhRetroactiveRequest,
        rejectPhRetroactiveRequest,
        generateDeliveryQrToken,
        submitCustomerInspection,
        submitPhCustomerInspection,
        reviewRejectedPhWO,
        logCustomerQrView,
        markWorkOrderAsOpenedByAdmin,
        requestSupport,
    });

    const value = useMemo(() => ({
        workOrders,
        projects,
        staff,
        contractors,
        loading,
        taskDrafts,
        ...stable
    }), [workOrders, projects, staff, contractors, loading, taskDrafts, stable]);

    return (
        <WorkOrderContext.Provider value={value}>
            {children}
        </WorkOrderContext.Provider>
    );
};

export const useWorkOrders = () => {
    const context = useContext(WorkOrderContext);
    if (context === undefined) {
        throw new Error('useWorkOrders must be used within a WorkOrderProvider');
    }
    return context;
};
