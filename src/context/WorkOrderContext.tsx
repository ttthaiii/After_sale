import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { WorkOrder, Category, MasterTask, DailyReport, Project, Staff, Contractor } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface WorkOrderContextType {
    workOrders: WorkOrder[];
    getWorkOrderById: (id: string) => WorkOrder | undefined;
    updateTask: (workOrderId: string, categoryId: string, taskId: string, updates: Partial<MasterTask>) => Promise<void>;
    addWorkOrder: (wo: WorkOrder) => Promise<void>;
    updateWorkOrderStatus: (id: string, status: string) => Promise<void>;
    saveEvaluation: (id: string, status: string, categories: any[]) => Promise<void>;
    addTaskUpdate: (workOrderId: string, categoryId: string, taskId: string, report: DailyReport) => Promise<void>;
    projects: Project[];
    staff: Staff[];
    contractors: Contractor[];
    loading: boolean;
    deleteWorkOrder: (id: string) => Promise<void>;
    archiveWorkOrder: (id: string) => Promise<void>;
    markWorkOrderAsReviewed: (id: string) => Promise<void>;
    requestRetroactiveUnlock: (workOrderId: string, categoryId: string, taskId: string, date: string, reason: string) => Promise<void>;
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
const formatCategoriesAndTasks = (woId: string, categories: any[]): any[] => {
    if (!categories || categories.length === 0) return [];

    // Guard: only WOA/WOP
    const isWoaWop = woId.toUpperCase().includes('WOA') || woId.toUpperCase().includes('WOP');
    if (!isWoaWop) return categories;

    // Parse WO ID — e.g. ART-2026-WOA-0002
    const parts = woId.split('-');
    const projectCode = parts[0].toUpperCase();                                        // "ART"
    const jobCode     = parts.length >= 2 ? parts[parts.length - 2].toUpperCase() : 'WOA'; // "WOA"
    const woSeq       = parts.length >= 1 ? parts[parts.length - 1] : '0001';          // "0002"

    // Global task counter — increments across ALL categories in this WO (prevents internal dups)
    let globalTaskCounter = 0;

    return categories.map((cat, catIndex) => {
        const catName = (cat.name || '').trim().toLowerCase();
        const listIndex = CATEGORIES_LIST.findIndex(n => n.trim().toLowerCase() === catName);

        // 1-indexed category type position; fallback to array position if name not found
        const position = listIndex >= 0 ? listIndex + 1 : catIndex + 1;

        // Category ID: ProjectCode-JobCode-CatTypeSeq4digits
        // e.g. ART-WOA-0004  (tiles in ART project, any WO number)
        const computedCatId = `${projectCode}-${jobCode}-${String(position).padStart(4, '0')}`;

        // Task ID: ProjectCode-JobCode-WOSeq-globalTaskSeq7digits
        // e.g. ART-WOA-0002-0000001  (globally unique across all projects and WOs)
        const tasks = cat.tasks ? cat.tasks.map((task: any) => {
            globalTaskCounter++;
            const computedTaskId = `${projectCode}-${jobCode}-${woSeq}-${String(globalTaskCounter).padStart(7, '0')}`;
            return {
                ...task,
                id: computedTaskId,
                taskCode: computedTaskId,
                catId: computedCatId
            };
        }) : [];

        return {
            ...cat,
            id: computedCatId,
            catId: computedCatId,
            tasks
        };
    });
};

export const WorkOrderProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [allWorkOrders, setAllWorkOrders] = useState<WorkOrder[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(true);

    // ✅ Deep Fetch for Sub-collections (The Bridge)
    const fetchSubcollections = async (woId: string): Promise<Category[]> => {
        const categoriesSnap = await getDocs(collection(db, 'workOrders', woId, 'categories'));
        const categories: Category[] = [];

        // Sort categories alphabetically by document ID for stable deterministic ordering
        const sortedCategoryDocs = [...categoriesSnap.docs].sort((a, b) => a.id.localeCompare(b.id));

        for (const catDoc of sortedCategoryDocs) {
            const catData = catDoc.data();
            const tasksSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks'));
            const tasks: MasterTask[] = [];

            // Sort tasks alphabetically by document ID for stable deterministic ordering
            const sortedTaskDocs = [...tasksSnap.docs].sort((a, b) => a.id.localeCompare(b.id));

            for (const taskDoc of sortedTaskDocs) {
                const taskData = taskDoc.data();
                const reportsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'dailyreport'));
                const dailyreports = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id }) as DailyReport);
                
                const taskCode = taskDoc.id;

                tasks.push({ 
                    ...taskData, 
                    id: taskDoc.id, 
                    taskCode,
                    dailyreports,
                    history: dailyreports // ✅ Backward compatibility for legacy UI components
                } as unknown as MasterTask);
            }
            categories.push({ ...catData, id: catDoc.id, tasks } as Category);
        }
        return categories;
    };

    // ✅ REAL-TIME SYNC: Reverting to a more stable root listener with reactive integration
    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const unsubscribeWO = onSnapshot(collection(db, 'workOrders'), async (snapshot) => {
            const ordersPromises = snapshot.docs.map(async (docSnapshot) => {
                const baseData = docSnapshot.data() as WorkOrder;
                const categories = await fetchSubcollections(docSnapshot.id);
                return {
                    ...baseData,
                    id: docSnapshot.id,
                    categories
                };
            });
            
            const fullOrders = await Promise.all(ordersPromises);
            setAllWorkOrders(fullOrders);
            setLoading(false);
        });

        onSnapshot(collection(db, 'projects'), s => setProjects(s.docs.map(d => ({ ...d.data(), id: d.id }) as Project)));
        onSnapshot(collection(db, 'users'), s => {
            const mappedStaff = s.docs.map(docSnapshot => {
                const userData = docSnapshot.data();
                const empId = docSnapshot.id;
                
                let role: 'Foreman' | 'Admin' | 'Manager' | 'BackOffice' | 'Approver' = 'Foreman';
                
                // Align roles according to Labor Standard (Image 3): AM = Admin, FM = Foreman
                if (userData.roleId === 'AM' || userData.roleId === 'PE' || empId === '100051' || empId === '101485' || empId === 'admin1') {
                    role = 'Admin';
                } else if (userData.roleId === 'FM' || userData.roleId === 'GOD' || empId === '101527') {
                    role = 'Foreman';
                }
                
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
        onSnapshot(collection(db, 'contractors'), s => setContractors(s.docs.map(d => ({ ...d.data(), id: d.id }) as Contractor)));

        return () => unsubscribeWO();
    }, [user]);

    // ✅ Filter and assemble the final list for the UI
    const workOrders = useMemo(() => {
        if (!user) return [];
        let filtered = allWorkOrders;
        if (user.role !== 'Admin' && user.role !== 'BackOffice' && user.role !== 'Manager' && user.role !== 'Approver') {
            filtered = allWorkOrders.filter(wo => {
                const isAssignedProject = user.assignedProjects?.includes(wo.projectId || '');
                // ✅ Check match against BOTH system id and employeeId during transition
                const isReporter = wo.reporterId === user.id || (user.employeeId && wo.reporterId === user.employeeId);
                
                // Also check if they are responsible for any task in this WO
                const isResponsible = wo.categories?.some(cat => 
                    cat.tasks?.some(task => 
                        task.responsibleStaffIds?.includes(user.id) || 
                        (user.employeeId && task.responsibleStaffIds?.includes(user.employeeId))
                    )
                );

                return isAssignedProject || isReporter || isResponsible;
            });
        }
        return filtered;
    }, [allWorkOrders, user]);

    const getWorkOrderById = (id: string) => workOrders.find(wo => wo.id === id);

    const addWorkOrder = async (wo: WorkOrder) => {
        const isWoaWop = wo.id.toUpperCase().includes('WOA') || wo.id.toUpperCase().includes('WOP');
        
        if (!isWoaWop) {
            // Standard/Legacy write for non-WOA/WOP systems (unmodified)
            const { categories, ...rest } = wo;
            await setDoc(doc(db, 'workOrders', wo.id), rest);
            if (categories && categories.length > 0) {
                const batch = writeBatch(db);
                for (const cat of categories) {
                    const catRef = doc(db, 'workOrders', wo.id, 'categories', cat.id);
                    const { tasks, ...catRest } = cat;
                    batch.set(catRef, catRest);

                    if (tasks) {
                        for (const task of tasks) {
                            const taskRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', task.id);
                            batch.set(taskRef, task);
                        }
                    }
                }
                await batch.commit();
            }
            return;
        }

        // Format categories and tasks to have structured document IDs matching the LB format for WOA/WOP
        const formattedCategories = formatCategoriesAndTasks(wo.id, wo.categories || []);
        const woWithFormattedCategories = {
            ...wo,
            categories: formattedCategories
        };
        const { categories, ...rest } = woWithFormattedCategories;
        
        // Clean up any existing categories/tasks for this work order to prevent orphans
        try {
            const oldCategoriesSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories'));
            if (!oldCategoriesSnap.empty) {
                const deleteBatch = writeBatch(db);
                for (const catDoc of oldCategoriesSnap.docs) {
                    const oldTasksSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks'));
                    for (const taskDoc of oldTasksSnap.docs) {
                        const oldReportsSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'dailyreport'));
                        for (const reportDoc of oldReportsSnap.docs) {
                            deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'dailyreport', reportDoc.id));
                        }
                        deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id, 'tasks', taskDoc.id));
                    }
                    deleteBatch.delete(doc(db, 'workOrders', wo.id, 'categories', catDoc.id));
                }
                await deleteBatch.commit();
            }
        } catch (error) {
            console.error("Error cleaning up legacy subcollections in addWorkOrder:", error);
        }

        await setDoc(doc(db, 'workOrders', wo.id), rest);
        
        if (formattedCategories && formattedCategories.length > 0) {
            const batch = writeBatch(db);
            for (const cat of formattedCategories) {
                const catRef = doc(db, 'workOrders', wo.id, 'categories', cat.id);
                const { tasks, ...catRest } = cat;
                batch.set(catRef, catRest);

                if (tasks) {
                    for (const task of tasks) {
                        const { dailyreports, dailyReport, ...taskRest } = task;
                        const taskRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', task.id);
                        batch.set(taskRef, taskRest);

                        const reportsToSave = dailyreports || dailyReport || [];
                        for (const report of reportsToSave) {
                            const reportRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', task.id, 'dailyreport', report.id);
                            batch.set(reportRef, report);
                        }
                    }
                }
            }
            await batch.commit();
        }
    };

    const saveEvaluation = async (id: string, status: string, categories: any[]) => {
        const isWoaWop = id.toUpperCase().includes('WOA') || id.toUpperCase().includes('WOP');
        
        if (!isWoaWop) {
            // Standard/Legacy write for non-WOA/WOP systems (unmodified)
            const batch = writeBatch(db);
            batch.update(doc(db, 'workOrders', id), { status, lastUpdate: new Date().toISOString() });
            if (categories) {
                for (const cat of categories) {
                    const catRef = doc(db, 'workOrders', id, 'categories', cat.id);
                    const { tasks, ...catRest } = cat;
                    batch.set(catRef, catRest);

                    if (tasks) {
                        for (const task of tasks) {
                            const taskRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id);
                            batch.set(taskRef, task);
                        }
                    }
                }
            }
            await batch.commit();
            return;
        }

        const formattedCategories = formatCategoriesAndTasks(id, categories || []);
        
        // Clean up any existing categories/tasks for this work order to prevent orphans
        try {
            const oldCategoriesSnap = await getDocs(collection(db, 'workOrders', id, 'categories'));
            if (!oldCategoriesSnap.empty) {
                const deleteBatch = writeBatch(db);
                for (const catDoc of oldCategoriesSnap.docs) {
                    const oldTasksSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks'));
                    for (const taskDoc of oldTasksSnap.docs) {
                        const oldReportsSnap = await getDocs(collection(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'dailyreport'));
                        for (const reportDoc of oldReportsSnap.docs) {
                            deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskDoc.id, 'dailyreport', reportDoc.id));
                        }
                        deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id, 'tasks', taskDoc.id));
                    }
                    deleteBatch.delete(doc(db, 'workOrders', id, 'categories', catDoc.id));
                }
                await deleteBatch.commit();
            }
        } catch (error) {
            console.error("Error cleaning up legacy subcollections in saveEvaluation:", error);
        }

        const batch = writeBatch(db);
        batch.update(doc(db, 'workOrders', id), { status, lastUpdate: new Date().toISOString() });

        for (const cat of formattedCategories) {
            const catRef = doc(db, 'workOrders', id, 'categories', cat.id);
            const { tasks, ...catRest } = cat;
            batch.set(catRef, catRest);

            if (tasks) {
                for (const task of tasks) {
                    const { dailyreports, dailyReport, ...taskRest } = task;
                    const taskRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id);
                    batch.set(taskRef, taskRest);

                    const reportsToSave = dailyreports || dailyReport || [];
                    for (const report of reportsToSave) {
                        const reportRef = doc(db, 'workOrders', id, 'categories', cat.id, 'tasks', task.id, 'dailyreport', report.id);
                        batch.set(reportRef, report);
                    }
                }
            }
        }
        await batch.commit();
    };

    const addTaskUpdate = async (workOrderId: string, categoryId: string, taskId: string, report: DailyReport) => {
        // Ensure date is in a clean YYYY-MM-DD format for dashboard filtering if it's an ISO string
        const reportDate = report.date.includes('T') ? report.date.split('T')[0] : report.date;
        
        const finalReport = {
            ...report,
            date: reportDate, // Standardize to YYYY-MM-DD for consistency
            serverTimestamp: new Date().toISOString() // Keep track of when it was actually clicked
        };

        const reportRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId, 'dailyreport', report.id);
        await setDoc(reportRef, finalReport);

        const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId);
        const taskDoc = allWorkOrders.find(w => w?.id === workOrderId)?.categories?.find(c => c?.id === categoryId)?.tasks?.find(t => t?.id === taskId);
        
        if (taskDoc) {
            const isCompleted = report.progress === 100 || (taskDoc.dailyProgress === 100);
            const newProgress = Math.max(taskDoc.dailyProgress || 0, report.progress || 0);
            
            await updateDoc(taskRef, {
                dailyProgress: newProgress,
                status: isCompleted ? 'Completed' : 'In Progress',
                updatedAt: new Date().toISOString()
            });
        }
        await updateDoc(doc(db, 'workOrders', workOrderId), { lastUpdate: new Date().toISOString() });
    };

    const updateTask = async (workOrderId: string, categoryId: string, taskId: string, updates: Partial<MasterTask>) => {
        const taskRef = doc(db, 'workOrders', workOrderId, 'categories', categoryId, 'tasks', taskId);
        await updateDoc(taskRef, updates);
    };

    const updateWorkOrderStatus = async (id: string, status: string) => {
        await updateDoc(doc(db, 'workOrders', id), { status, lastUpdate: new Date().toISOString() });
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

    const deleteWorkOrder = async (id: string) => {
        await updateDoc(doc(db, 'workOrders', id), { status: 'Cancelled', isArchived: true });
    };

    const archiveWorkOrder = async (id: string) => {
        await updateDoc(doc(db, 'workOrders', id), { isArchived: true });
    };

    const markWorkOrderAsReviewed = async (id: string) => {
        try {
            await updateDoc(doc(db, 'workOrders', id), { 
                reviewedByAdmin: true,
                reviewedAt: new Date().toISOString(),
                adminReviewedAt: new Date().toISOString()
            });
        } catch (err) {
            console.error("Failed to mark as reviewed:", err);
        }
    };

    return (
        <WorkOrderContext.Provider value={{
            workOrders,
            getWorkOrderById,
            updateTask,
            addWorkOrder,
            updateWorkOrderStatus,
            saveEvaluation,
            addTaskUpdate,
            projects,
            staff,
            contractors,
            loading,
            deleteWorkOrder,
            archiveWorkOrder,
            markWorkOrderAsReviewed,
            requestRetroactiveUnlock
        }}>
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
