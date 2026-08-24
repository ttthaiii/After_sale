export interface SLAStatus {
    text: string;
    color: string;
    bg: string;
    level: 'normal' | 'warning' | 'critical' | 'danger';
    hoursLeft?: number;
    taskName?: string;
    categoryName?: string;
}

export interface DashboardTask {
    id: string;
    name: string;
    status: string;
    dailyProgress: number;
    slaCategory: string;
    slaStartTime?: string;
    responsibleStaffIds?: string[];
    history?: any[];
    rootCause?: string;
    notes?: string;
}

export interface DashboardWorkOrder {
    id: string;
    woId?: string;
    status: string;
    createdAt: string;
    completedAt?: string;
    projectId: string;
    locationName?: string;
    startDate?: string;
    endDate?: string;
    categories: {
        name: string;
        tasks: DashboardTask[];
    }[];
    statusInfo?: SLAStatus;
    taskName?: string;
    reporterId?: string;
}

export interface DashboardStats {
    totalInMonth: number;
    newThisMonth: number;
    carriedOver: number;
    total: number;
    closed: number;
    open: number;
    totalTasksInScope: number;
    subtaskDone: number;        // การ์ดรายการย่อย: งานย่อยที่ทำครบ 100% (isWorkDone)
    subtaskInProgress: number;  // กำลังทำ (confirmed progress > 0, < 100)
    subtaskNotStarted: number;  // ยังไม่เริ่ม (confirmed progress = 0)
    evaluating: number;
    slaScore: number | null;
    highRisk: number;
    pendingAdminEval: number;
    closedWOsInScope: number;
    doneAwaitingQR: number;   // เสร็จ 100% แต่ยังไม่ออก QR
    donePendingEval: number;  // ส่ง QR แล้ว รอลูกค้าประเมิน (pending_delivery)
    doneReceived: number;     // ลูกค้ารับมอบแล้ว (Complete)
    totalHours: number;
    totalBudget: number;
    totalActualCost: number;
    projectStats: any[];
    stalledCases: any[];
    chronicIssues: any[];
    budgetPerformance: any[];
    laborByProject: any[];
    totalAssignments: number;
    laborStats: any[];
    internalHours: number;
    outsourceHours: number;
    internalCount: number;
    outsourceCount: number;
    urgentTasks: DashboardWorkOrder[];
    upcomingTasks: DashboardWorkOrder[];
    dueTodayCount: number;
    categoryStats: any[];
    foremanStats: any[];
}
