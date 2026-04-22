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
}

const WorkOrderContext = createContext<WorkOrderContextType | undefined>(undefined);

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

        for (const catDoc of categoriesSnap.docs) {
            const catData = catDoc.data();
            const tasksSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks'));
            const tasks: MasterTask[] = [];

            for (const taskDoc of tasksSnap.docs) {
                const taskData = taskDoc.data();
                const reportsSnap = await getDocs(collection(db, 'workOrders', woId, 'categories', catDoc.id, 'tasks', taskDoc.id, 'dailyreport'));
                const dailyreports = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id }) as DailyReport);
                
                tasks.push({ 
                    ...taskData, 
                    id: taskDoc.id, 
                    dailyreports,
                    history: dailyreports // ✅ Backward compatibility for legacy UI components
                } as MasterTask);
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
        onSnapshot(collection(db, 'staff'), s => setStaff(s.docs.map(d => ({ ...d.data(), id: d.id }) as Staff)));
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
    };

    const saveEvaluation = async (id: string, status: string, categories: any[]) => {
        const batch = writeBatch(db);
        batch.update(doc(db, 'workOrders', id), { status, lastUpdate: new Date().toISOString() });

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
            const newProgress = Math.max(taskDoc.dailyProgress || 0, report.progress);
            
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
                reviewedAt: new Date().toISOString()
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
            markWorkOrderAsReviewed
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
