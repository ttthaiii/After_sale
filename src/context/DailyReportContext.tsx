import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from "react";
import { db, storage } from "../lib/firebase";
import { collection, onSnapshot, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { useWorkOrders } from "./WorkOrderContext";
import { useAuth } from "./AuthContext";
import { useNotifications } from "./NotificationContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { compressImage } from "../utils/imageCompression";
import { formatDate } from "../utils/date";
import { useNavigate, useLocation } from "react-router-dom";
import { logService } from "../services/logService";
import {
  LaborEntry,
  WorkTask,
  WorkOrder,
  SelectedTaskInfo,
  TaskListItem,
  ModalAlertState,
  BatchConfig,
  TimePickerTarget,
  RealProject,
  RealContractor,
  DailyContractor,
  PendingDeliveryItem,
  HistoryLaborEntry,
  HistoryLeaveEntry,
  HistoryPhotos,
  EditHistoryRecord,
  ShiftConfig,
} from "../types/dailyReport.types";

interface DailyReportContextType {
  // Database / Contexts
  workOrders: any[];
  user: any;
  sendNotification: any;
  navigate: any;
  location: any;
  foremanId: string;
  
  // Selection / Highlight States
  highlightedId: string | null;
  setHighlightedId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedTaskInfo: SelectedTaskInfo | null;
  setSelectedTaskInfo: React.Dispatch<React.SetStateAction<SelectedTaskInfo | null>>;
  isTaskFinished: boolean;

  // Search & Task Groupings
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  progress: number;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  labor: LaborEntry[];
  setLabor: React.Dispatch<React.SetStateAction<LaborEntry[]>>;
  sitePhotos: (File | string | null)[];
  setSitePhotos: React.Dispatch<React.SetStateAction<(File | string | null)[]>>;
  
  // Shift Photos
  laborRegularPhotos: (File | string | null)[];
  setLaborRegularPhotos: React.Dispatch<React.SetStateAction<(File | string | null)[]>>;
  laborOtMorningPhotos: (File | string | null)[];
  setLaborOtMorningPhotos: React.Dispatch<React.SetStateAction<(File | string | null)[]>>;
  laborOtNoonPhotos: (File | string | null)[];
  setLaborOtNoonPhotos: React.Dispatch<React.SetStateAction<(File | string | null)[]>>;
  laborOtEveningPhotos: (File | string | null)[];
  setLaborOtEveningPhotos: React.Dispatch<React.SetStateAction<(File | string | null)[]>>;
  activePhotoTab: string;
  setActivePhotoTab: React.Dispatch<React.SetStateAction<string>>;
  zoomImage: string | null;
  setZoomImage: React.Dispatch<React.SetStateAction<string | null>>;
  
  // Layout & UI States
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showCalendarDropdown: boolean;
  setShowCalendarDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  showUnlockModal: boolean;
  setShowUnlockModal: React.Dispatch<React.SetStateAction<boolean>>;
  pendingUnlockDate: string;
  setPendingUnlockDate: React.Dispatch<React.SetStateAction<string>>;
  unlockReason: string;
  setUnlockReason: React.Dispatch<React.SetStateAction<string>>;
  calendarYear: number;
  setCalendarYear: React.Dispatch<React.SetStateAction<number>>;
  calendarMonth: number;
  setCalendarMonth: React.Dispatch<React.SetStateAction<number>>;
  isEditingExisting: boolean;
  setIsEditingExisting: React.Dispatch<React.SetStateAction<boolean>>;
  showSummaryModal: boolean;
  setShowSummaryModal: React.Dispatch<React.SetStateAction<boolean>>;
  collapsedHelpers: Record<string, boolean>;
  setCollapsedHelpers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  
  // Submission & Loader States
  isUploading: boolean;
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>;
  uploadingLeaveCertId: string | null;
  setUploadingLeaveCertId: React.Dispatch<React.SetStateAction<string | null>>;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  submittingRef: React.MutableRefObject<boolean>;
  retroactiveSubmitDone: boolean;
  setRetroactiveSubmitDone: React.Dispatch<React.SetStateAction<boolean>>;
  activeModal: "Internal" | "Outsource" | null;
  setActiveModal: React.Dispatch<React.SetStateAction<"Internal" | "Outsource" | null>>;
  timePickerTarget: TimePickerTarget | null;
  setTimePickerTarget: React.Dispatch<React.SetStateAction<TimePickerTarget | null>>;
  reportType: "Update" | "Problem";
  setReportType: React.Dispatch<React.SetStateAction<"Update" | "Problem">>;
  reportDate: string;
  setReportDate: React.Dispatch<React.SetStateAction<string>>;
  
  // Masters Data List
  realContractors: RealContractor[];
  realProjects: RealProject[];
  dailyContractors: DailyContractor[];
  
  // Modal alerts
  modalAlert: ModalAlertState | null;
  setModalAlert: React.Dispatch<React.SetStateAction<ModalAlertState | null>>;
  isReviewModalOpen: boolean;
  setIsReviewModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  reviewTaskInfo: any | null;
  setReviewTaskInfo: React.Dispatch<React.SetStateAction<any | null>>;
  isCustomerMockupOpen: boolean;
  setIsCustomerMockupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mockupWorkOrder: any | null;
  setMockupWorkOrder: React.Dispatch<React.SetStateAction<any | null>>;
  
  // Computed Staff Lists
  availableStaff: DailyContractor[];
  availableContractors: RealContractor[];
  
  // Computed Grouped Tasks Columns
  newTasks: TaskListItem[];
  inProgressTasks: TaskListItem[];
  pendingInspectionTasks: TaskListItem[];
  pendingDeliveryWorkOrders: PendingDeliveryItem[];
  
  // central hooks functions
  addTaskUpdate: any;
  updateTask: any;
  updateWorkOrderStatus: any;
  requestRetroactiveUnlock: any;
  submitRetroactiveRequest: any;
  generateDeliveryQrToken: any;
  submitCustomerInspection: any;
  
  // Handlers & Helpers
  handleSelectTask: (task: WorkTask, wo: WorkOrder, categoryId: string) => void;
  handleBatchAdd: (selectedIds: string[], config: BatchConfig) => void;
  handleTimeChange: (val: string) => void;
  handleRemoveSlotPhoto: (tab: string, index: number) => void;
  handleSlotPhotoUpload: (tab: string, index: number, e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleUploadLeaveCert: (laborId: string, file: File | undefined) => Promise<void>;
  handleRemoveLeaveCert: (laborId: string) => void;
  handleConfirmReview: (woId: string, categoryId: string, taskId: string, status: string, updates: any) => Promise<void>;
  handleBounceBackSLA: (workOrderId: string, categoryId: string, taskId: string) => Promise<void>;
  handleSubmit: () => Promise<void>;
  handleFinalSubmit: () => Promise<void>;
  handleSaveDraft: () => Promise<void>;
  handleCancelEdit: () => void;
  handleDateChange: (newDateStr: string) => void;
  
  // Inner Helper Logic States (Cleaned to correct signatures & formats)
  toggleShift: (laborId: string, shiftKey: keyof ShiftConfig) => void;
  getDateStatus: (dateStr: string, task: WorkTask, wo: WorkOrder) => "disabled" | "reported" | "unlocked" | "locked";
  isProgressNotePhotosEditable: boolean;
  hasHistoryForSelectedDate: boolean;
  getTaskImage: (task: WorkTask) => string | null;
  openTimePicker: (id: string, shift: string, type: "start" | "end") => void;
  
  // Computed helpers to expose
  isReportDatePast3Days: boolean;
  isTimeOverlap: (time1: string, time2: string) => boolean;
  progressBounds: { min: number; max: number; isToday: boolean };
  draftedTaskIds: Set<string>;
}

const DailyReportContext = createContext<DailyReportContextType | undefined>(undefined);

export const filterHistoryByRevision = (
  history: any[],
  revisionCreatedAt: string | null | undefined,
  currentRevision?: string
): any[] => {
  if (!history) return [];
  
  if (currentRevision) {
    const hasRevisionId = history.some((h) => h.revisionId);
    if (hasRevisionId) {
      return history.filter((h) => h.revisionId === currentRevision);
    }
  }

  if (!revisionCreatedAt) return history;
  return history.filter((h: any) => {
    const hTime = h.createdAt || h.serverTimestamp || h.date;
    if (!hTime) return false;
    
    let hDateStr = "";
    if (typeof hTime === "string") {
      hDateStr = hTime.split("T")[0];
    } else if (hTime && typeof hTime === "object") {
      if (typeof hTime.toDate === "function") {
        hDateStr = hTime.toDate().toISOString().split("T")[0];
      } else if (hTime.seconds !== undefined) {
        hDateStr = new Date(hTime.seconds * 1000).toISOString().split("T")[0];
      }
    }
    
    const revDateStr = typeof revisionCreatedAt === "string" 
      ? revisionCreatedAt.split("T")[0] 
      : "";
      
    return hDateStr && revDateStr && hDateStr >= revDateStr;
  });
};

export const calculateWorkingHours = (timeRange: string): number => {
  if (!timeRange) return 8;
  const match = timeRange.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
  if (!match) return 8;
  const startHour = parseInt(match[1], 10);
  const startMin = parseInt(match[2], 10);
  const endHour = parseInt(match[3], 10);
  const endMin = parseInt(match[4], 10);
  
  const startDecimal = startHour + startMin / 60;
  const endDecimal = endHour + endMin / 60;
  let diff = endDecimal - startDecimal;
  
  // Subtract 1 hour for lunch break if the shift spans from <= 12:00 to >= 13:00
  if (startDecimal <= 12 && endDecimal >= 13) {
    diff -= 1;
  }
  
  return Math.max(0, Math.round(diff * 100) / 100);
};

export const getRequiredRegularPhotoCount = (laborList: any[]): number => {
  const normalLabor = laborList.filter((l: any) => l.shifts?.normal);
  if (normalLabor.length === 0) return 4;

  const getShiftStartHour = (timeRange: string): number => {
    if (!timeRange) return 8;
    const parts = timeRange.split(" - ");
    if (parts.length < 1) return 8;
    const [h, m] = parts[0].split(":").map(Number);
    if (isNaN(h)) return 8;
    return h + (isNaN(m) ? 0 : m) / 60;
  };
  
  const getShiftEndHour = (timeRange: string): number => {
    if (!timeRange) return 17;
    const parts = timeRange.split(" - ");
    if (parts.length < 2) return 17;
    const timePart = parts[1];
    const [h, m] = timePart.split(":").map(Number);
    if (isNaN(h)) return 17;
    return h + (isNaN(m) ? 0 : m) / 60;
  };
  
  const minStartHour = normalLabor.reduce((min, l) => {
    const startHour = getShiftStartHour(l.shiftTimes?.day || "08:00 - 17:00");
    return Math.min(min, startHour);
  }, 24);

  const maxEndHour = normalLabor.reduce((max, l) => {
    const endHour = getShiftEndHour(l.shiftTimes?.day || "08:00 - 17:00");
    return Math.max(max, endHour);
  }, 0);
  
  if (minStartHour >= 13.0 || maxEndHour <= 12.0) {
    return 2;
  }
  return 4;
};

export const DailyReportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    workOrders: _workOrders,
    addTaskUpdate,
    updateTask,
    updateWorkOrderStatus,
    requestRetroactiveUnlock,
    submitRetroactiveRequest,
    generateDeliveryQrToken,
    submitCustomerInspection,
  } = useWorkOrders();
  const workOrders = _workOrders as any[];
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const foremanId = user?.id || "admin-initial";
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedTaskInfo, setSelectedTaskInfo] =
    useState<SelectedTaskInfo | null>(null);

  // Sync selectedTaskInfo with live updates from workOrders (e.g. from Admin Evaluation)
  useEffect(() => {
    if (!selectedTaskInfo) return;
    const latestWo = workOrders.find((w) => w.id === selectedTaskInfo.wo.id);
    if (!latestWo) return;
    const latestTask = latestWo.categories
      .flatMap((c: any) => c.tasks)
      .find((t: any) => t.id === selectedTaskInfo.task.id);
    if (!latestTask) return;

    // Deep-compare history: check labor count and progress for the most recent entry
    // This detects updates when re-submitting the same day (length unchanged but content changed)
    const latestHistoryEntry = latestTask.history?.[0];
    const currentHistoryEntry = selectedTaskInfo.task.history?.[0];
    const historyContentChanged =
      (latestHistoryEntry?.labor?.length ?? -1) !== (currentHistoryEntry?.labor?.length ?? -1) ||
      (latestHistoryEntry?.progress ?? -1) !== (currentHistoryEntry?.progress ?? -1) ||
      (latestHistoryEntry?.date ?? '') !== (currentHistoryEntry?.date ?? '');

    const hasTaskChanged =
      latestTask.status !== selectedTaskInfo.task.status ||
      latestTask.dailyProgress !== selectedTaskInfo.task.dailyProgress ||
      latestTask.currentRevision !== selectedTaskInfo.task.currentRevision ||
      latestTask.slaCategory !== selectedTaskInfo.task.slaCategory ||
      latestTask.startDate !== selectedTaskInfo.task.startDate ||
      latestTask.revisionCreatedAt !== selectedTaskInfo.task.revisionCreatedAt ||
      latestTask.history?.length !== selectedTaskInfo.task.history?.length ||
      historyContentChanged ||
      JSON.stringify(latestTask.responsibleStaffIds) !== JSON.stringify(selectedTaskInfo.task.responsibleStaffIds);

    const hasWoChanged =
      latestWo.status !== selectedTaskInfo.wo.status ||
      latestWo.reviewedByAdmin !== selectedTaskInfo.wo.reviewedByAdmin;

    const isReadOnlyMissing = selectedTaskInfo.task.isReadOnly === undefined;

    if (hasTaskChanged || hasWoChanged || isReadOnlyMissing) {
      const categoryId = latestWo.categories.find((c: any) =>
        c.tasks.some((t: any) => t.id === latestTask.id)
      )?.id || selectedTaskInfo.categoryId;

      const isHelper =
        latestTask.helperForemanIds?.includes(user?.employeeId || user?.id || foremanId) ||
        latestTask.assignedForeman === (user?.employeeId || user?.id || foremanId);
      const isSubtaskOperator =
        latestTask.subtaskOperatorId === user?.id ||
        (user?.employeeId && latestTask.subtaskOperatorId === user.employeeId) ||
        latestTask.responsibleStaffIds?.includes(foremanId);
      const isWoRejectedAwaitingAdmin1 = 
        latestWo.pendingAdminReassign === true ||
        (latestWo.pendingAdminReassign === undefined && latestWo.reviewedByAdmin === false && latestWo.status === 'Rejected');
      const isReadOnly =
        isWoRejectedAwaitingAdmin1 ||
        (!isSubtaskOperator && !isHelper &&
          user?.role !== "Admin" &&
          user?.role !== "Manager");

      setSelectedTaskInfo({
        task: { ...latestTask, isReadOnly, isHelper },
        wo: latestWo,
        categoryId
      });
    }
  }, [workOrders, selectedTaskInfo, user, foremanId]);

  const isTaskFinished = useMemo(() => {
    if (!selectedTaskInfo) return false;
    const currentWo = workOrders.find((w) => w.id === selectedTaskInfo.wo.id);
    const currentTask =
      currentWo?.categories
        .flatMap((c: any) => c.tasks)
        .find((t: any) => t.id === selectedTaskInfo.task.id) ||
      selectedTaskInfo.task;
    const history = currentTask.history || [];
    const filteredHistory = filterHistoryByRevision(history, currentTask.revisionCreatedAt, currentTask.currentRevision);
    const historyMax =
      filteredHistory.reduce((max: number, h: any) => Math.max(max, h.progress), 0) || 0;
    const actualProgress = Math.max(currentTask.dailyProgress || 0, historyMax);
    return (
      actualProgress >= 100 ||
      [
        "Completed",
        "Verified",
        "Approved",
        "completed",
        "pending_inspection",
        "for-checking",
      ].includes(currentTask.status)
    );
  }, [selectedTaskInfo, workOrders]);

  const [searchTerm, setSearchTerm] = useState("");
  const [draftedTaskIds, setDraftedTaskIds] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem('draftedTaskIds');
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState("");
  const [labor, setLabor] = useState<LaborEntry[]>([]);
  const [sitePhotos, setSitePhotos] = useState<(File | string | null)[]>([]);
  const [laborRegularPhotos, setLaborRegularPhotos] = useState<
    (File | string | null)[]
  >([]);
  const [laborOtMorningPhotos, setLaborOtMorningPhotos] = useState<
    (File | string | null)[]
  >([]);
  const [laborOtNoonPhotos, setLaborOtNoonPhotos] = useState<
    (File | string | null)[]
  >([]);
  const [laborOtEveningPhotos, setLaborOtEveningPhotos] = useState<
    (File | string | null)[]
  >([]);
  const [activePhotoTab, setActivePhotoTab] = useState("site");
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [pendingUnlockDate, setPendingUnlockDate] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [collapsedHelpers, setCollapsedHelpers] = useState<
    Record<string, boolean>
  >({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingLeaveCertId, setUploadingLeaveCertId] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [retroactiveSubmitDone, setRetroactiveSubmitDone] = useState(false);
  const [activeModal, setActiveModal] = useState<
    "Internal" | "Outsource" | null
  >(null);
  const [timePickerTarget, setTimePickerTarget] =
    useState<TimePickerTarget | null>(null);
  const [reportType, setReportType] = useState<"Update" | "Problem">("Update");
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [realContractors, setRealContractors] = useState<RealContractor[]>([]);
  const [realProjects, setRealProjects] = useState<RealProject[]>([]);
  const [dailyContractors, setDailyContractors] = useState<DailyContractor[]>(
    [],
  );
  const [modalAlert, setModalAlert] = useState<ModalAlertState | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewTaskInfo, setReviewTaskInfo] = useState<{
    task: WorkTask;
    categoryId: string;
    woId: string;
    wo?: any;
  } | null>(null);
  const [isCustomerMockupOpen, setIsCustomerMockupOpen] = useState(false);
  const [mockupWorkOrder, setMockupWorkOrder] = useState<any | null>(
    null,
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedTaskInfo) return false;
    const { task } = selectedTaskInfo;
    const history = task.history || [];
    const todayStr = new Date().toISOString().split("T")[0];
    const filteredHistory = filterHistoryByRevision(history, task.revisionCreatedAt, task.currentRevision);
    const historyBeforeToday = filteredHistory
      .filter((h) => (h.date?.split("T")[0] || "") < todayStr)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const minP =
      historyBeforeToday.length > 0 ? historyBeforeToday[0].progress : 0;
    const currentP = task.dailyProgress || 0;
    const initialProgress = currentP < minP ? minP : currentP;

    const progressChanged = progress !== initialProgress;
    const noteChanged = note.trim() !== "";
    const laborChanged = labor.length > 0;
    const photosChanged =
      sitePhotos.length > 0 ||
      laborRegularPhotos.length > 0 ||
      laborOtMorningPhotos.length > 0 ||
      laborOtNoonPhotos.length > 0 ||
      laborOtEveningPhotos.length > 0;

    return progressChanged || noteChanged || laborChanged || photosChanged;
  }, [
    selectedTaskInfo,
    progress,
    note,
    labor,
    sitePhotos,
    laborRegularPhotos,
    laborOtMorningPhotos,
    laborOtNoonPhotos,
    laborOtEveningPhotos,
  ]);

  // Alert on tab close/reload if there are unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "คุณมีข้อมูลรายงานความคืบหน้าที่ยังไม่ได้บันทึกค้างอยู่ หากออกจากหน้านี้ ข้อมูลที่กรอกไว้ทั้งหมดจะสูญหาย";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Sync hasUnsavedChanges with window global for Sidebar navigation intercept
  useEffect(() => {
    (window as any).hasUnsavedChanges = hasUnsavedChanges;
    return () => {
      (window as any).hasUnsavedChanges = false;
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const unsubContractors = onSnapshot(
      collection(db, "contractors"),
      (snap) => {
        setRealContractors(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<RealContractor, "id">),
            id: d.id,
          })),
        );
      },
    );
    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      setRealProjects(
        snap.docs.map((d) => ({
          ...(d.data() as Omit<RealProject, "id">),
          id: d.id,
        })),
      );
    });
    const unsubDailyContractors = onSnapshot(
      collection(db, "dailyContractors"),
      (snap) => {
        setDailyContractors(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<DailyContractor, "id">),
            id: d.id,
          })),
        );
      },
    );
    return () => {
      unsubContractors();
      unsubProjects();
      unsubDailyContractors();
    };
  }, []);

  useEffect(() => {
    if (!selectedTaskInfo) return;
    let active = true;
    const existingReport = selectedTaskInfo.task.history?.find((h) => {
      const matchesRevision = h.revisionId === (selectedTaskInfo.task.currentRevision || 'rev00');
      const matchesHelper = selectedTaskInfo.task.isHelper ? h.isSupportReport === true : h.isSupportReport !== true;
      return matchesRevision && h.date?.split("T")[0] === reportDate && matchesHelper;
    });
    if (existingReport) {
      setProgress(existingReport.progress);
      setNote(existingReport.note || "");
      const mergedLabor: LaborEntry[] = [];
      const laborMap = new Map<string, HistoryLaborEntry>();
      const leaveMap = new Map<string, HistoryLeaveEntry>();
      if (existingReport.labor) {
        existingReport.labor.forEach((l) =>
          laborMap.set(l.workerId || l.id || "", l),
        );
      }
      const exLeave = existingReport.leave;
      if (exLeave) {
        exLeave.forEach((l) => leaveMap.set(l.workerId || l.id || "", l));
      }
      const allWorkerIds = Array.from(
        new Set([...laborMap.keys(), ...leaveMap.keys()]),
      );
      allWorkerIds.forEach((wId) => {
        const l = laborMap.get(wId);
        const lv = leaveMap.get(wId);
        const isInternal =
          wId.startsWith("DC-") ||
          (l && !l.contractorId) ||
          (lv && !lv.contractorId);
        mergedLabor.push({
          id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          membership: isInternal ? "Internal" : "Outsource",
          staffId: wId,
          staffName:
            l?.staffName ||
            l?.workerName ||
            lv?.staffName ||
            lv?.workerName ||
            "",
          employeeId: l?.employeeId || lv?.employeeId || "",
          affiliation:
            l?.staffName || l?.workerName
              ? isInternal
                ? l?.staffName || l?.workerName || "General"
                : l?.staffName || l?.workerName || "General"
              : lv?.staffName || lv?.workerName || "General",
          amount: Number(l?.amount) || 1,
          timeType: "Normal",
          shifts: {
            normal: l?.shifts?.normal || false,
            otMorning: l?.shifts?.otMorning || false,
            otNoon: l?.shifts?.otNoon || false,
            otEvening: l?.shifts?.otEvening || false,
          },
          shiftTimes: {
            day: l?.shiftTimes?.day || "08:00 - 17:00",
            otMorning: l?.shiftTimes?.otMorning || "06:00 - 08:00",
            otNoon: "12:00 - 13:00",
            otEvening: l?.shiftTimes?.otEvening || "18:00 - 21:00",
          },
          leave: {
            active: lv?.leaveShifts?.custom || false,
            time: lv?.leaveTimes?.custom || "08:00 - 17:00",
            medCertFileUrl: lv?.medCertFileUrl || "",
          },
          recordedBy: l?.recordedBy || lv?.recordedBy || "",
        });
      });
      setLabor(mergedLabor);
      const mapRegularFromDb = (dbShift: any): (string | null)[] => {
        if (!dbShift) return [];
        if (Array.isArray(dbShift))
          return [
            dbShift[0] || "",
            dbShift[1] || "",
            dbShift[2] || "",
            dbShift[3] || "",
          ];
        return [
          dbShift.in || "",
          dbShift.lunch || "",
          dbShift.afternoon || "",
          dbShift.out || "",
        ];
      };
      const mapOtShiftFromDb = (dbShift: any): (string | null)[] => {
        if (!dbShift) return [];
        if (Array.isArray(dbShift)) return [dbShift[0] || "", dbShift[1] || ""];
        return [dbShift.in || "", dbShift.out || ""];
      };
      if (existingReport.photos && !Array.isArray(existingReport.photos)) {
        const pObj = existingReport.photos as HistoryPhotos;
        setSitePhotos(pObj.site || []);
        setLaborRegularPhotos(mapRegularFromDb(pObj.laborByShift?.regular));
        setLaborOtMorningPhotos(mapOtShiftFromDb(pObj.laborByShift?.otMorning));
        setLaborOtNoonPhotos(mapOtShiftFromDb(pObj.laborByShift?.otNoon));
        setLaborOtEveningPhotos(mapOtShiftFromDb(pObj.laborByShift?.otEvening));
      } else {
        const pArr = (existingReport.photos as string[]) || [];
        setSitePhotos(pArr);
        setLaborRegularPhotos(existingReport.laborPhotos || []);
        setLaborOtMorningPhotos([]);
        setLaborOtNoonPhotos([]);
        setLaborOtEveningPhotos([]);
      }
      setActivePhotoTab("site");
      setIsEditingExisting(false);
    } else {
      const history = selectedTaskInfo.task.history || [];
      const filteredHistory = filterHistoryByRevision(history, selectedTaskInfo.task.revisionCreatedAt, selectedTaskInfo.task.currentRevision);
      const priorEntries = filteredHistory
        .filter((h) => (h.date?.split("T")[0] || "") < reportDate)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      
      let min = 0;
      if (priorEntries.length > 0) {
        min = priorEntries[0].progress;
      } else {
        const isToday = reportDate === new Date().toISOString().split("T")[0];
        min = isToday ? (selectedTaskInfo.task.dailyProgress || 0) : 0;
      }
      
      const defaultProgress = min > 0 ? min + 1 : 0;
      const lastEntry = priorEntries[0];

      const checkAndLoadDraft = async () => {
        try {
          const isWoaWop =
            selectedTaskInfo.wo.id.toUpperCase().includes("WOA") ||
            selectedTaskInfo.wo.id.toUpperCase().includes("WOP");
          const workOrderId = selectedTaskInfo.wo.id;
          const categoryId = selectedTaskInfo.categoryId;
          const taskId = selectedTaskInfo.task.id;
          const getSubtaskId = (tId: string): string => {
            if (tId) {
              return tId.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
            }
            return tId;
          };
          const subtaskId = getSubtaskId(taskId);
          const taskDoc = workOrders.find((w) => w?.id === workOrderId)?.categories?.find((c: any) => c?.id === categoryId)?.tasks?.find((t: any) => t?.id === taskId);
          const currentRev = taskDoc?.currentRevision || "rev00";
          let draftDocRef;
          if (isWoaWop) {
            if (selectedTaskInfo.task.isHelper) {
              const helpId = currentRev.replace('rev', 'help');
              draftDocRef = doc(db, "workOrders", workOrderId, "categories", categoryId, "tasks", taskId, "subtasks", subtaskId, "help", helpId, "dailyReportsDraft", reportDate);
            } else {
              draftDocRef = doc(db, "workOrders", workOrderId, "categories", categoryId, "tasks", taskId, "subtasks", subtaskId, "revisions", currentRev, "dailyReportsDraft", reportDate);
            }
          } else {
            draftDocRef = doc(db, "workOrders", workOrderId, "categories", categoryId, "tasks", taskId, "dailyreportDraft", reportDate);
          }
          const draftSnap = await getDoc(draftDocRef);
          if (!active) return;
          if (draftSnap.exists()) {
            const draftData = draftSnap.data();
            setProgress(draftData.progress ?? defaultProgress);
            setNote(draftData.note || "");
            setLabor(draftData.labor || []);
            setSitePhotos(draftData.sitePhotos || []);
            setLaborRegularPhotos(draftData.laborRegularPhotos || []);
            setLaborOtMorningPhotos(draftData.laborOtMorningPhotos || []);
            setLaborOtNoonPhotos(draftData.laborOtNoonPhotos || []);
            setLaborOtEveningPhotos(draftData.laborOtEveningPhotos || []);
            setActivePhotoTab("site");
            if (draftData.isPendingRetroactive) {
              setRetroactiveSubmitDone(true);
            }
            setIsEditingExisting(isTaskFinished ? false : true);
            return;
          }
        } catch (err) {
          console.error("Error checking draft:", err);
        }
        if (!active) return;
        setProgress(defaultProgress);
        setNote("");
        setLabor([]);
        setSitePhotos([]);
        setLaborRegularPhotos([]);
        setLaborOtMorningPhotos([]);
        setLaborOtNoonPhotos([]);
        setLaborOtEveningPhotos([]);
        setActivePhotoTab("site");
        setIsEditingExisting(isTaskFinished ? false : true);
      };
      checkAndLoadDraft();
    }
    return () => {
      active = false;
    };
  }, [reportDate, selectedTaskInfo?.task.id]);

  useEffect(() => {
    if (user) {
      logService.trackPageView(
        user,
        "REPORTING",
        "หน้าส่งงานรายวัน (Daily Report)",
      );
    }
  }, [user]);

  const {
    newTasks,
    inProgressTasks,
    pendingInspectionTasks,
    pendingDeliveryWorkOrders,
  } = useMemo(() => {
    const _newTasks: TaskListItem[] = [];
    const _inProgressTasks: TaskListItem[] = [];
    const _pendingInspectionTasks: TaskListItem[] = [];
    const _pendingDeliveryWOs: PendingDeliveryItem[] = [];
    workOrders.forEach((wo) => {
      if (["Draft", "Cancelled", "Completed", "Verified"].includes(wo.status))
        return;
      const isWoOwner =
        wo.woOwnerId === user?.id ||
        (user?.employeeId && wo.woOwnerId === user.employeeId) ||
        wo.reporterId === user?.id ||
        (user?.employeeId && wo.reporterId === user.employeeId);
      const isParticipant =
        user?.role === "Admin" ||
        user?.role === "Manager" ||
        isWoOwner ||
        wo.categories.some((cat: any) =>
          cat.tasks.some((t: any) =>
            t.subtaskOperatorId === user?.id ||
            (user?.employeeId && t.subtaskOperatorId === user.employeeId) ||
            t.responsibleStaffIds?.includes(foremanId) ||
            t.helperForemanIds?.includes(user?.employeeId || user?.id || foremanId) ||
            t.assignedForeman === (user?.employeeId || user?.id || foremanId)
          )
        );
      const hasActiveTasks = wo.categories.some((cat: any) =>
        cat.tasks.some((t: any) => t.status !== "Pending" && t.status !== "Verified")
      );
      let totalActiveTasks = 0;
      let completedActiveTasks = 0;
      const woTasksList: TaskListItem[] = [];
      wo.categories.forEach((cat: any) => {
        cat.tasks.forEach((task: any) => {
          const shouldSkip =
            (task.status === "Pending" || task.status === "Verified") &&
            (!isParticipant || !hasActiveTasks);
          if (shouldSkip)
            return;
          const isWoOwner2 = isWoOwner;
          const isSubtaskOperator =
            task.subtaskOperatorId === user?.id ||
            (user?.employeeId && task.subtaskOperatorId === user.employeeId) ||
            task.responsibleStaffIds?.includes(foremanId);
          const isHelper =
            task.helperForemanIds?.includes(user?.employeeId || user?.id || foremanId) ||
            task.assignedForeman === (user?.employeeId || user?.id || foremanId);
          let isAssigned = false;
          if (task.isSupportRequest) {
            isAssigned =
              user?.role === "Admin" ||
              user?.role === "Manager" ||
              isHelper;
          } else {
            isAssigned =
              user?.role === "Admin" ||
              user?.role === "Manager" ||
              isWoOwner2 ||
              isSubtaskOperator ||
              isHelper ||
              (wo.reporterId === user?.id &&
                task.status === "Approved" &&
                (!task.responsibleStaffIds ||
                  task.responsibleStaffIds.length === 0));
          }
          if (isAssigned) {
            const filteredHistory = filterHistoryByRevision(task.history || [], task.revisionCreatedAt, task.currentRevision);
            const historyMax =
              filteredHistory.reduce(
                (max: number, h: any) => Math.max(max, h.progress),
                0,
              ) || 0;
            const actualProgress = Math.max(
              task.dailyProgress || 0,
              historyMax,
            );
            const isWoRejectedAwaitingAdmin2 =
              wo.pendingAdminReassign === true ||
              (wo.pendingAdminReassign === undefined && wo.reviewedByAdmin === false && wo.status === 'Rejected');
            const isReadOnly =
              isWoRejectedAwaitingAdmin2 ||
              (!isSubtaskOperator && !isHelper &&
                user?.role !== "Admin" &&
                user?.role !== "Manager");
            const item: TaskListItem = {
              task: { ...task, dailyProgress: actualProgress, isReadOnly, isHelper },
              wo,
              categoryId: cat.id,
            };
            if (searchTerm) {
              const match =
                (task.name || "")
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase()) ||
                (wo.locationName || "")
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase()) ||
                (wo.id || "").toLowerCase().includes(searchTerm.toLowerCase());
              if (!match) return;
            }
            totalActiveTasks++;
            if (actualProgress === 100) {
              completedActiveTasks++;
            }
            woTasksList.push(item);
          }
        });
      });

      const globalTasks = wo.categories.flatMap((c: any) => c.tasks);
      const globalIsAllCompleted =
        globalTasks.length > 0 &&
        globalTasks.every(
          (t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100
        );

      const isGroupedDelivery =
        ["pending_delivery", "Completed", "Rejected"].includes(wo.status) ||
        globalIsAllCompleted;

      if (isParticipant && isGroupedDelivery) {
        _pendingDeliveryWOs.push({ wo });
      } else {
        woTasksList.forEach((item) => {
          if (item.task.dailyProgress === 100) {
            _pendingInspectionTasks.push(item);
          } else if (item.task.dailyProgress && item.task.dailyProgress > 0) {
            _inProgressTasks.push(item);
          } else {
            _newTasks.push(item);
          }
        });
      }
    });
    return {
      newTasks: _newTasks,
      inProgressTasks: _inProgressTasks,
      pendingInspectionTasks: _pendingInspectionTasks,
      pendingDeliveryWorkOrders: _pendingDeliveryWOs,
    };
  }, [
    workOrders,
    searchTerm,
    foremanId,
    user?.role,
    user?.employeeId,
    user?.id,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const workOrderId = params.get("id");
    if (workOrderId && workOrders.length > 0) {
      const item =
        newTasks.find((n) => n.wo.id === workOrderId) ||
        inProgressTasks.find((i) => i.wo.id === workOrderId) ||
        pendingInspectionTasks.find((p) => p.wo.id === workOrderId);
      if (item) {
        const isWoRejectedAwaitingAdmin =
          item.wo.pendingAdminReassign === true ||
          (item.wo.pendingAdminReassign === undefined && item.wo.reviewedByAdmin === false && item.wo.status === 'Rejected');
        if (isWoRejectedAwaitingAdmin) {
          setModalAlert({
            isOpen: true,
            title: "อยู่ระหว่างรอแอดมินมอบหมายตารางเวลาใหม่",
            message: "ใบสั่งงานนี้ถูกระงับการดำเนินงานชั่วคราว เพื่อรอให้แอดมินจัดสรรรอบเวลาการแก้ไขงานใหม่",
            type: "warning",
          });
        } else {
          setHighlightedId(workOrderId);
          handleSelectTask(item.task, item.wo, item.categoryId);
        }
      } else {
        const wo = workOrders.find((w) => w.id === workOrderId);
        if (wo) {
          let message = "";
          let title = "ใบสั่งงานไม่พร้อมสำหรับการรายงาน";
          let type: "info" | "success" | "error" | "warning" = "info";
          if (wo.status === "Completed") {
            message =
              "งานในใบงานนี้ได้รับการรายงานความคืบหน้าครบถ้วนและเสร็จสิ้นเรียบร้อยแล้ว";
            title = "ใบสั่งงานเสร็จสิ้นแล้ว";
            type = "success";
          } else if (wo.status === "Cancelled") {
            message = "ใบสั่งงานนี้ถูกยกเลิกการดำเนินงานแล้ว";
            title = "ใบสั่งงานถูกยกเลิก";
            type = "error";
          } else if (wo.status === "Rejected") {
            if (wo.pendingAdminReassign === true ||
                (wo.pendingAdminReassign === undefined && wo.reviewedByAdmin === false)) {
              message =
                "ใบสั่งงานนี้ถูกระงับการดำเนินงานชั่วคราว เพื่อรอให้แอดมินจัดสรรรอบเวลาการแก้ไขงานใหม่";
              title = "อยู่ระหว่างรอแอดมินมอบหมายตารางเวลาใหม่";
              type = "warning";
            } else {
              const globalTasks = wo.categories.flatMap((c: any) => c.tasks);
              const activeTask =
                globalTasks.find((t: any) => t.evaluationStatus === "Rejected") ||
                globalTasks.find((t: any) => (t.dailyProgress || t.progress || 0) < 100) ||
                globalTasks[0];
              if (activeTask) {
                const catId =
                  wo.categories.find((c: any) =>
                    c.tasks.some((t: any) => t.id === activeTask.id)
                  )?.id || wo.categories[0]?.id;
                setHighlightedId(workOrderId);
                handleSelectTask(activeTask, wo, catId);
                return;
              }
              message = "งานในใบสั่งงานแก้ไขนี้ได้รับการดำเนินการครบถ้วนแล้ว";
              title = "งานแก้ไขเสร็จสิ้น";
              type = "success";
            }
          } else if (wo.status === "Draft") {
            message =
              "ใบสั่งงานนี้ยังคงอยู่ในสถานะแบบร่าง กรุณาส่งใบงานเพื่อรับการประเมินจากแอดมิน";
            title = "ใบสั่งงานแบบร่าง";
            type = "warning";
          } else if (wo.status === "Evaluating") {
            message =
              "ใบสั่งงานนี้อยู่ระหว่างขั้นตอนการประเมินโดยแอดมิน หรือยังไม่มีงานประเมินที่ระบุให้คุณรับผิดชอบในขณะนี้";
            title = "อยู่ระหว่างการประเมิน";
            type = "info";
          } else {
            const statusThai: Record<string, string> = {
              Pending: "รออนุมัติ",
              Approved: "อนุมัติแล้ว",
              "Partially Approved": "อนุมัติบางส่วน",
              "In Progress": "กำลังดำเนินการ",
              Verified: "ตรวจสอบแล้ว",
            };
            message = `ไม่พบงานที่พร้อมสำหรับการรายงานความคืบหน้าในระบบ (สถานะปัจจุบันของใบงาน: ${statusThai[wo.status] || wo.status})`;
            title = "ไม่สามารถรายงานความคืบหน้าได้";
            type = "info";
          }
          setModalAlert({
            isOpen: true,
            title,
            message,
            type,
          });
        } else {
          setModalAlert({
            isOpen: true,
            title: "ไม่พบใบสั่งงาน",
            message:
              "ไม่พบข้อมูลใบสั่งงานนี้ในระบบ หรือคุณไม่มีสิทธิ์ในการรายงานความคืบหน้าของงานชุดนี้",
            type: "error",
          });
        }
      }
      const newParams = new URLSearchParams(location.search);
      newParams.delete("id");
      const newSearch = newParams.toString();
      navigate(location.pathname + (newSearch ? `?${newSearch}` : ""), {
        replace: true,
      });
    }
  }, [
    location.search,
    newTasks,
    inProgressTasks,
    workOrders,
    navigate,
    pendingInspectionTasks,
  ]);

  const handleSelectTask = (
    task: WorkTask,
    wo: WorkOrder,
    categoryId: string,
  ) => {
    // 1. If clicking the SAME task, ignore it entirely to prevent state reset
    if (selectedTaskInfo?.task?.id === task.id) {
      return;
    }

    // 2. If clicking a DIFFERENT task and there are unsaved changes, ask for confirmation
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        "คุณมีข้อมูลรายงานความคืบหน้าที่ยังไม่ได้บันทึกค้างอยู่ หากเปลี่ยนงาน ข้อมูลที่กรอกไว้ทั้งหมดจะสูญหาย\n\nต้องการเปลี่ยนงานหรือไม่?"
      );
      if (!confirmLeave) {
        return;
      }
    }

    const history = task.history || [];
    const todayStr = new Date().toISOString().split("T")[0];
    const filteredHistory = filterHistoryByRevision(history, task.revisionCreatedAt, task.currentRevision);
    const historyBeforeToday = filteredHistory
      .filter((h) => (h.date?.split("T")[0] || "") < todayStr)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const minP =
      historyBeforeToday.length > 0 ? historyBeforeToday[0].progress : 0;
    const currentP = task.dailyProgress || 0;

    const isHelper =
      task.helperForemanIds?.includes(user?.employeeId || user?.id || foremanId) ||
      task.assignedForeman === (user?.employeeId || user?.id || foremanId);
    const isSubtaskOperator =
      task.subtaskOperatorId === user?.id ||
      (user?.employeeId && task.subtaskOperatorId === user.employeeId) ||
      task.responsibleStaffIds?.includes(foremanId);
    const isWoRejectedAwaitingAdmin3 =
      wo.pendingAdminReassign === true ||
      (wo.pendingAdminReassign === undefined && wo.reviewedByAdmin === false && wo.status === 'Rejected');
    const isReadOnly =
      isWoRejectedAwaitingAdmin3 ||
      (!isSubtaskOperator && !isHelper &&
        user?.role !== "Admin" &&
        user?.role !== "Manager");

    setSelectedTaskInfo({ task: { ...task, isReadOnly, isHelper }, wo, categoryId });
    setRetroactiveSubmitDone(false);
    setProgress(currentP < minP ? minP : currentP);
    setNote("");
    setLabor([]);
    setSitePhotos([]);
    setLaborRegularPhotos([]);
    setLaborOtMorningPhotos([]);
    setLaborOtNoonPhotos([]);
    setLaborOtEveningPhotos([]);
    setReportType("Update");
    setReportDate(new Date().toISOString().split("T")[0]);
  };

  const getDateStatus = (dateStr: string, task: WorkTask, wo: WorkOrder) => {
    const todayStr = new Date().toISOString().split("T")[0];
    if (dateStr > todayStr) {
      return "disabled";
    }
    const openingDate = wo.startDate || wo.createdAt || "";
    const openingDateStr = openingDate
      ? new Date(openingDate).toISOString().split("T")[0]
      : "";
    if (openingDateStr && dateStr < openingDateStr) {
      return "disabled";
    }
    const isHelperTask = (task as any).isHelper === true;
    const reported = task.history?.some(
      (h) => h.revisionId === (task.currentRevision || 'rev00') &&
             h.date?.split("T")[0] === dateStr &&
             (isHelperTask ? h.isSupportReport === true : h.isSupportReport !== true),
    );
    if (reported) {
      return "reported";
    }
    const todayVal = new Date(todayStr).getTime();
    const dateVal = new Date(dateStr).getTime();
    const diffTime = todayVal - dateVal;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const unlocked =
      task.unlockedDates?.[dateStr] &&
      new Date(task.unlockedDates[dateStr].unlockedUntil).getTime() >
        Date.now();
    if (diffDays <= 3 || unlocked) {
      return "unlocked";
    }
    return "locked";
  };

  const progressBounds = useMemo(() => {
    if (!selectedTaskInfo) return { min: 0, max: 100, isToday: true };
    const history = selectedTaskInfo.task.history || [];
    const isHelperMode = selectedTaskInfo.task.isHelper === true;
    const filteredHistory = filterHistoryByRevision(history, selectedTaskInfo.task.revisionCreatedAt, selectedTaskInfo.task.currentRevision)
      .filter((h) => isHelperMode ? h.isSupportReport === true : h.isSupportReport !== true);
    const targetDate = reportDate;
    let min = 0;
    let max = 100;
    filteredHistory.forEach((h) => {
      const hDate = h.date?.split("T")[0] || "";
      if (!hDate) return;
      if (hDate < targetDate) {
        if (h.progress > min) min = h.progress;
      } else if (hDate > targetDate) {
        // Enforce progressive range: progress of targetDate must be strictly less than future report's progress (progress - 1)
        const allowedMax = h.progress - 1;
        if (allowedMax < max) max = allowedMax;
      }
    });
    const isToday = reportDate === new Date().toISOString().split("T")[0];
    const effectiveMax = isToday ? 100 : Math.min(max, 99);
    return { min, max: effectiveMax, isToday };
  }, [selectedTaskInfo, reportDate]);

  const isReportDatePast3Days = useMemo(() => {
    if (!selectedTaskInfo) return false;
    const todayStr = new Date().toISOString().split("T")[0];
    const todayVal = new Date(todayStr).getTime();
    const dateVal = new Date(reportDate).getTime();
    const diffTime = todayVal - dateVal;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const unlocked =
      selectedTaskInfo.task.unlockedDates?.[reportDate] &&
      new Date(
        selectedTaskInfo.task.unlockedDates[reportDate].unlockedUntil,
      ).getTime() > Date.now();
    return diffDays > 3 && !unlocked;
  }, [reportDate, selectedTaskInfo?.task.unlockedDates]);

  const isProgressNotePhotosEditable =
    isEditingExisting &&
    !isTaskFinished &&
    !selectedTaskInfo?.task?.isReadOnly &&
    !(selectedTaskInfo?.wo?.pendingAdminReassign === true ||
      (selectedTaskInfo?.wo?.pendingAdminReassign === undefined && selectedTaskInfo?.wo?.reviewedByAdmin === false && selectedTaskInfo?.wo?.status === 'Rejected'));

  const hasHistoryForSelectedDate = useMemo(() => {
    if (!selectedTaskInfo) return false;
    const isHelperMode = selectedTaskInfo.task.isHelper;
    return (
      selectedTaskInfo.task.history?.some(
        (h) => {
          const matchesRevision = h.revisionId === (selectedTaskInfo.task.currentRevision || 'rev00');
          const matchesHelper = isHelperMode ? h.isSupportReport === true : h.isSupportReport !== true;
          return matchesRevision && h.date?.split("T")[0] === reportDate && matchesHelper;
        }
      ) || false
    );
  }, [selectedTaskInfo, reportDate]);

  const getTaskImage = (task: WorkTask) => {
    const img =
      task.beforePhotoUrl ||
      task.latestPhotoUrl ||
      task.afterPhotoUrl ||
      (task.images && task.images.length > 0 ? task.images[0] : null) ||
      (task.attachments && task.attachments.length > 0
        ? task.attachments[0].url
        : null);
    if (
      img &&
      typeof img === "string" &&
      (img.startsWith("http") ||
        img.startsWith("https") ||
        img.startsWith("blob:"))
    ) {
      return img;
    }
    return null;
  };

  const handleBatchAdd = (selectedIds: string[], config: BatchConfig) => {
    const newRecords: LaborEntry[] = [];
    if (activeModal === "Internal") {
      selectedIds.forEach((id) => {
        const contractor = dailyContractors.find((c) => c.id === id);
        if (contractor) {
          newRecords.push({
            id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            membership: "Internal",
            staffId: contractor.id,
            staffName: contractor.name,
            employeeId:
              contractor.employeeId || contractor.id.replace("DC-", ""),
            affiliation: contractor.skillId || "General",
            amount: 1,
            timeType: "Normal",
            shifts: {
              normal: config.day,
              otMorning: config.otMorning,
              otNoon: config.otNoon,
              otEvening: config.otEvening,
            },
            shiftTimes: {
              day: config.timeDay,
              otMorning: config.timeOtMorning,
              otNoon: "12:00 - 13:00",
              otEvening: config.timeOtEvening,
            },
            leave: {
              active: false,
              time: "08:00 - 17:00",
              medCertFileUrl: "",
            },
            recordedBy: user?.employeeId || user?.id || "",
          });
        }
      });
    } else if (activeModal === "Outsource") {
      selectedIds.forEach((id) => {
        const contractor = realContractors.find((c) => c.id === id);
        if (contractor) {
          newRecords.push({
            id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            membership: "Outsource",
            affiliation: contractor.name,
            contractorId: contractor.id,
            employeeId: "",
            amount: 1,
            timeType: "Normal",
            shifts: {
              normal: config.day,
              otMorning: false,
              otNoon: false,
              otEvening: false,
            },
            shiftTimes: { day: "" },
            leave: {
              active: false,
              time: "08:00 - 17:00",
              medCertFileUrl: "",
            },
            recordedBy: user?.employeeId || user?.id || "",
          });
        }
      });
    }
    setLabor([...labor, ...newRecords]);
    setActiveModal(null);
  };

  const isTimeOverlap = (time1: string, time2: string) => {
    if (!time1 || !time2 || time1.includes("--") || time2.includes("--"))
      return false;
    const parse = (t: string) => {
      const [start, end] = t.split(" - ").map((s) => {
        const [h, m] = s.split(":").map(Number);
        return h * 60 + (m || 0);
      });
      return { start, end };
    };
    try {
      const t1 = parse(time1);
      const t2 = parse(time2);
      return t1.start < t2.end && t2.start < t1.end;
    } catch (e) {
      return false;
    }
  };

  const toggleShift = (id: string, shiftKey: keyof ShiftConfig) => {
    if (!isEditingExisting) return;
    setLabor((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const currentShifts = l.shifts || {
          normal: false,
          otMorning: false,
          otNoon: false,
          otEvening: false,
        };
        const isActive = !currentShifts[shiftKey];
        let newShiftTimes = { ...(l.shiftTimes || {}) };
        let leaveObj = l.leave
          ? { ...l.leave }
          : { active: false, time: "08:00 - 17:00" };
        if (isActive && l.membership === "Internal") {
          if (shiftKey === "otMorning" && !newShiftTimes.otMorning)
            newShiftTimes.otMorning = "06:00 - 08:00";
          if (shiftKey === "otNoon" && !newShiftTimes.otNoon)
            newShiftTimes.otNoon = "12:00 - 13:00";
          if (shiftKey === "otEvening" && !newShiftTimes.otEvening)
            newShiftTimes.otEvening = "18:00 - 21:00";
        }
        if (isActive && shiftKey !== "normal" && leaveObj.active) {
          const otDefaultTimes: Record<string, string> = {
            otMorning: "06:00 - 08:00",
            otNoon: "12:00 - 13:00",
            otEvening: "18:00 - 21:00",
          };
          const otTime =
            newShiftTimes[shiftKey] || otDefaultTimes[shiftKey] || "";
          if (
            otTime &&
            isTimeOverlap(otTime, leaveObj.time || "08:00 - 17:00")
          ) {
            return l;
          }
        }
        let updatedShifts = { ...currentShifts, [shiftKey]: isActive };
        if (shiftKey === "normal") {
          if (isActive) {
            const regTime = newShiftTimes.day || "08:00 - 17:00";
            if (
              leaveObj.active &&
              isTimeOverlap(regTime, leaveObj.time || "08:00 - 17:00")
            ) {
              const leaveTime = leaveObj.time || "08:00 - 17:00";
              if (leaveTime === "08:00 - 12:00") {
                newShiftTimes.day = "13:00 - 17:00";
              } else if (leaveTime === "13:00 - 17:00") {
                newShiftTimes.day = "08:00 - 12:00";
              } else {
                leaveObj.active = false;
              }
            }
          } else {
            updatedShifts.otMorning = false;
            updatedShifts.otNoon = false;
            updatedShifts.otEvening = false;
          }
        }
        return {
          ...l,
          shifts: updatedShifts,
          shiftTimes: newShiftTimes,
          leave: leaveObj,
        };
      }),
    );
  };

  const openTimePicker = (id: string, shift: string, type: "start" | "end") => {
    if (!isEditingExisting) return;
    const record = labor.find((l) => l.id === id);
    if (!record) return;
    let rangeStr = "";
    if (shift === "leave") {
      rangeStr = record.leave?.time || "08:00 - 17:00";
    } else if (record.shiftTimes) {
      if (shift === "normal")
        rangeStr = record.shiftTimes.day || "08:00 - 17:00";
      else rangeStr = (record.shiftTimes as any)[shift] || "";
    }
    if (!rangeStr) rangeStr = "00:00 - 00:00";
    const [start, end] = rangeStr.split(" - ").map((s) => s.trim());
    setTimePickerTarget({
      id,
      shift,
      type,
      currentValue: (type === "start" ? start : end) || "00:00",
    });
  };

  const handleTimeChange = (val: string) => {
    if (!timePickerTarget) return;
    const { id, type, shift } = timePickerTarget;
    setLabor((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (shift === "leave") {
          const leaveObj = l.leave || { active: true, time: "08:00 - 17:00" };
          let range = leaveObj.time || "08:00 - 17:00";
          let [start, end] = range.split(" - ").map((s) => s.trim());
          if (type === "start") start = val;
          else end = val;
          const newRange = `${start} - ${end}`;
          const updatedLeave = { ...leaveObj, time: newRange };
          let updatedTimes = l.shiftTimes
            ? { ...l.shiftTimes }
            : { day: "08:00 - 17:00" };
          let shiftsObj = l.shifts
            ? { ...l.shifts }
            : {
                normal: false,
                otMorning: false,
                otNoon: false,
                otEvening: false,
              };
          if (newRange === "08:00 - 12:00") {
            if (updatedTimes.day === "08:00 - 17:00" && shiftsObj.normal) {
              updatedTimes.day = "13:00 - 17:00";
            }
          } else if (newRange === "13:00 - 17:00") {
            if (updatedTimes.day === "08:00 - 17:00" && shiftsObj.normal) {
              updatedTimes.day = "08:00 - 12:00";
            }
          }
          const regTime = updatedTimes.day || "08:00 - 17:00";
          if (shiftsObj.normal && isTimeOverlap(newRange, regTime)) {
            shiftsObj.normal = false;
            shiftsObj.otMorning = false;
            shiftsObj.otNoon = false;
            shiftsObj.otEvening = false;
          }
          return {
            ...l,
            leave: updatedLeave,
            shiftTimes: updatedTimes,
            shifts: shiftsObj,
          };
        } else {
          const times = { ...(l.shiftTimes || {}) };
          let range = "";
          if (shift === "normal") range = times.day || "08:00 - 17:00";
          else range = (times as any)[shift] || "00:00 - 00:00";
          let [start, end] = range.split(" - ").map((s) => s.trim());
          if (type === "start") start = val;
          else end = val;
          const newRange = `${start} - ${end}`;
          let shiftsObj = l.shifts
            ? { ...l.shifts }
            : {
                normal: false,
                otMorning: false,
                otNoon: false,
                otEvening: false,
              };
          let leaveObj = l.leave
            ? { ...l.leave }
            : { active: false, time: "08:00 - 17:00" };
          if (shift === "normal") {
            times.day = newRange;
            if (
              leaveObj.active &&
              isTimeOverlap(newRange, leaveObj.time || "08:00 - 17:00")
            ) {
              leaveObj.active = false;
            }
          } else {
            (times as any)[shift] = newRange;
          }
          return {
            ...l,
            shiftTimes: times,
            shifts: shiftsObj,
            leave: leaveObj,
          };
        }
      }),
    );
  };

  useEffect(() => {
    const hasPhotosForShift = (shiftKey: string) => {
      if (!selectedTaskInfo?.task?.isHelper) return false;
      const mainReport = selectedTaskInfo.task.history?.find((h) => {
        const matchesRevision = h.revisionId === (selectedTaskInfo.task.currentRevision || 'rev00');
        const matchesMain = h.isSupportReport !== true;
        return matchesRevision && h.date?.split("T")[0] === reportDate && matchesMain;
      });
      if (!mainReport?.photos) {
        if (shiftKey === "regular" && mainReport?.laborPhotos) {
          return mainReport.laborPhotos.filter(Boolean).length > 0;
        }
        return false;
      }
      if (Array.isArray(mainReport.photos)) {
        return shiftKey === "regular" && mainReport.photos.filter(Boolean).length > 0;
      }
      const pObj = mainReport.photos as any;
      const dbShift = pObj.laborByShift?.[shiftKey];
      if (!dbShift) return false;
      if (Array.isArray(dbShift)) return dbShift.filter(Boolean).length > 0;
      return !!(dbShift.in || dbShift.lunch || dbShift.afternoon || dbShift.out);
    };

    const isRegularActive = labor.some((l) => l.shifts?.normal) || hasPhotosForShift("regular");
    const isOtMorningActive = labor.some((l) => l.shifts?.otMorning) || hasPhotosForShift("otMorning");
    const isOtNoonActive = labor.some((l) => l.shifts?.otNoon) || hasPhotosForShift("otNoon");
    const isOtEveningActive = labor.some((l) => l.shifts?.otEvening) || hasPhotosForShift("otEvening");

    if (activePhotoTab === "regular" && !isRegularActive)
      setActivePhotoTab("site");
    if (activePhotoTab === "otMorning" && !isOtMorningActive)
      setActivePhotoTab("site");
    if (activePhotoTab === "otNoon" && !isOtNoonActive)
      setActivePhotoTab("site");
    if (activePhotoTab === "otEvening" && !isOtEveningActive)
      setActivePhotoTab("site");
  }, [labor, activePhotoTab, selectedTaskInfo, reportDate]);

  const handleRemoveSlotPhoto = (tab: string, index: number) => {
    if (tab === "site") {
      setSitePhotos((prev) => prev.filter((_, i) => i !== index));
    } else {
      const clearSlot = (prev: any[]) => {
        const u = [...prev];
        u[index] = "";
        return u;
      };
      if (tab === "regular") setLaborRegularPhotos(clearSlot);
      else if (tab === "otMorning") setLaborOtMorningPhotos(clearSlot);
      else if (tab === "otNoon") setLaborOtNoonPhotos(clearSlot);
      else if (tab === "otEvening") setLaborOtEveningPhotos(clearSlot);
    }
  };

  const handleSlotPhotoUpload = async (
    tab: string,
    slotIndex: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTaskInfo) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `progress_${tab}_slot${slotIndex}_${Date.now()}.${fileExt}`;
      const storagePath = `work_orders/${selectedTaskInfo.wo.id}/progress/${fileName}`;
      const storageRef = ref(storage, storagePath);
      const compressedFile = await compressImage(file, 1280, 0.7);
      const snapshot = await uploadBytes(storageRef, compressedFile, {
        cacheControl: "public, max-age=31536000",
        contentType: compressedFile.type || "image/jpeg",
      });
      const downloadURL = await getDownloadURL(snapshot.ref);
      if (tab === "site") {
        setSitePhotos((prev) => [...prev, downloadURL]);
      } else {
        const putSlot = (prev: any[]) => {
          const u = [...prev];
          u[slotIndex] = downloadURL;
          return u;
        };
        if (tab === "regular") setLaborRegularPhotos(putSlot);
        else if (tab === "otMorning") setLaborOtMorningPhotos(putSlot);
        else if (tab === "otNoon") setLaborOtNoonPhotos(putSlot);
        else if (tab === "otEvening") setLaborOtEveningPhotos(putSlot);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert("อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleUploadLeaveCert = async (
    laborId: string,
    file: File | undefined,
  ) => {
    if (!file || !selectedTaskInfo) return;
    if (uploadingLeaveCertId === laborId) return;
    setUploadingLeaveCertId(laborId);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `leave_${laborId}_${Date.now()}.${fileExt}`;
      const storagePath = `work_orders/${selectedTaskInfo.wo.id}/leave_certs/${fileName}`;
      const storageRef = ref(storage, storagePath);
      const compressedFile = await compressImage(file, 1280, 0.7);
      const metadata = {
        cacheControl: "public, max-age=31536000",
        contentType: compressedFile.type || "image/jpeg",
      };
      const snapshot = await uploadBytes(storageRef, compressedFile, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);
      setLabor((prev) =>
        prev.map((l) => {
          if (l.id === laborId) {
            return {
              ...l,
              leave: {
                ...(l.leave || { active: true, time: "08:00 - 17:00" }),
                medCertFileUrl: downloadURL,
              },
            };
          }
          return l;
        }),
      );
    } catch (error) {
      console.error("Leave cert upload failed:", error);
      alert("อัปโหลดใบรับรองแพทย์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setUploadingLeaveCertId(null);
    }
  };

  const handleRemoveLeaveCert = (laborId: string) => {
    setLabor((prev) =>
      prev.map((l) => {
        if (l.id === laborId) {
          return {
            ...l,
            leave: {
              ...(l.leave || { active: true, time: "08:00 - 17:00" }),
              medCertFileUrl: "",
            },
          };
        }
        return l;
      }),
    );
  };

  const handleConfirmReview = async (
    woId: string,
    categoryId: string,
    taskId: string,
    status: string,
    updates: any,
  ) => {
    try {
      const now = new Date().toISOString();
      if (status === "Verified") {
        await updateTask(woId, categoryId, taskId, {
          status: "Verified",
          ownerName: updates.ownerName || "",
          notes: updates.notes || "",
          evaluationChecklist: updates.evaluationChecklist || {},
          overallSatisfaction: updates.overallSatisfaction || 0,
          updatedAt: now,
        });
        if (selectedTaskInfo?.task.id === taskId) {
          setSelectedTaskInfo(null);
        }
        setModalAlert({
          isOpen: true,
          title: "ตรวจรับงานสำเร็จ",
          message:
            "ระบบได้ตรวจรับงานเรียบร้อยแล้ว รายการนี้จะย้ายไปอยู่ในส่วนของประวัติงานย้อนหลัง",
          type: "success",
        });
      } else if (status === "Rejected") {
        await updateTask(woId, categoryId, taskId, {
          status: "Rejected",
          revisionName: updates.rejectReason || "",
          revisionCreatedAt: now,
          currentRevision: updates.currentRevision || "rev01",
          evaluationChecklist: updates.evaluationChecklist || {},
          dailyProgress: 0,
          updatedAt: now,
        });
        if (selectedTaskInfo?.task.id === taskId) {
          setSelectedTaskInfo(null);
        }
        setModalAlert({
          isOpen: true,
          title: "ส่งกลับแก้ไขสำเร็จ",
          message: `ระบบได้ส่งกลับแก้ไข (ตีกลับ) เรียบร้อยแล้ว โปรเกรสของงานถูกรีเซ็ตเป็น 0% (${updates.currentRevision || "REV. 01"})`,
          type: "warning",
        });
      }
    } catch (error) {
      console.error("Error confirming review:", error);
      setModalAlert({
        isOpen: true,
        title: "เกิดข้อผิดพลาด",
        message: "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
        type: "error",
      });
    }
  };

  const handleBounceBackSLA = async (
    workOrderId: string,
    categoryId: string,
    taskId: string,
  ) => {
    if (
      !window.confirm(
        "คุณต้องการตีกลับใบงานนี้เพื่อให้แอดมินประเมิน SLA ใหม่ใช่หรือไม่?\n(งานจะถูกถอดออกจากการมอบหมายและส่งกลับไปที่แอดมิน)",
      )
    )
      return;
    setIsSubmitting(true);
    try {
      await updateTask(workOrderId, categoryId, taskId, {
        status: "Pending",
        slaCategory: null,
        responsibleStaffIds: [],
      });
      await updateWorkOrderStatus(workOrderId, "Evaluating");
      await sendNotification({
        recipientRole: "Admin",
        senderId: user?.id || "foreman",
        senderName: user?.name || "Foreman",
        title: "ใบงานถูกตีกลับ (SLA Mismatch)",
        message: `งาน "${selectedTaskInfo?.task.name}" ถูกตีกลับโดยโฟร์แมนเพื่อขอประเมิน SLA ใหม่`,
        type: "warning",
        targetPath: `/evaluation?id=${workOrderId}`,
      });
      logService.trackAction({
        userId: user?.id || "unknown",
        userName: user?.name || "Unknown",
        role: user?.role || "Foreman",
        action: "UPDATE",
        module: "REPORTING",
        details: `Foreman rejected SLA (${selectedTaskInfo?.task.slaCategory}) and requested re-evaluation. Expected: ${selectedTaskInfo?.task.estimatedSla}`,
        targetId: taskId,
      });
      alert("ตีกลับใบงานเรียบร้อยแล้ว");
      setSelectedTaskInfo(null);
    } catch (err) {
      console.error("Bounce back error:", err);
      alert("เกิดข้อผิดพลาดในการตีกลับใบงาน");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (submittingRef.current || isSubmitting) return;
    if (!selectedTaskInfo) return;
    if (labor.length === 0)
      return alert("กรุณาระบุข้อมูลแรงงานที่เข้าดำเนินการ");
    if (!selectedTaskInfo.task.isHelper) {
      if (sitePhotos.filter(Boolean).length < 2)
        return alert("กรุณาแนบรูปถ่ายหน้างานอย่างน้อย 2 รูป");
      const isRegularActive = labor.some((l) => l.shifts?.normal);
      if (isRegularActive) {
        const requiredCount = getRequiredRegularPhotoCount(labor);
        const uploadedCount = laborRegularPhotos.filter(Boolean).length;
        if (uploadedCount < requiredCount) {
          if (requiredCount === 2) {
            return alert("กรุณาแนบรูปถ่ายแรงงานกะปกติให้ครบ 2 รูป (เข้า / ออก)");
          } else {
            return alert(
              "กรุณาแนบรูปถ่ายแรงงานกะปกติให้ครบ 4 รูป (เข้า / พักเที่ยง / เข้าบ่าย / ออก)",
            );
          }
        }
      }
      const isOtMorningActive = labor.some((l) => l.shifts?.otMorning);
      if (isOtMorningActive && laborOtMorningPhotos.filter(Boolean).length < 2) {
        return alert("กรุณาแนบรูปถ่ายแรงงาน OT เช้าให้ครบ 2 รูป (เข้า / ออก)");
      }
      const isOtNoonActive = labor.some((l) => l.shifts?.otNoon);
      if (isOtNoonActive && laborOtNoonPhotos.filter(Boolean).length < 2) {
        return alert("กรุณาแนบรูปถ่ายแรงงาน OT เที่ยงให้ครบ 2 รูป (เข้า / ออก)");
      }
      const isOtEveningActive = labor.some((l) => l.shifts?.otEvening);
      if (isOtEveningActive && laborOtEveningPhotos.filter(Boolean).length < 2) {
        return alert("กรุณาแนบรูปถ่ายแรงงาน OT เย็นให้ครบ 2 รูป (เข้า / ออก)");
      }
    }
    const allowedMinVal = progressBounds.min > 0 ? progressBounds.min : -1;
    if (progress <= allowedMinVal) {
      alert(
        `ความคืบหน้าสำหรับวันที่เลือกต้องมากกว่า ${progressBounds.min}% (ตามประวัติก่อนหน้า)`,
      );
      return;
    }
    if (progress > progressBounds.max) {
      alert(
        `ความคืบหน้าสำหรับวันที่เลือกต้องไม่เกิน ${progressBounds.max}% ${!progressBounds.isToday && progress === 100 ? "(ห้ามลงปิดงาน 100% ย้อนหลัง)" : "(เนื่องจากมีข้อมูลวันที่หลังจากนี้ลงไปแล้ว)"}`,
      );
      return;
    }
    const history = selectedTaskInfo.task.history || [];
    const filteredHistory = filterHistoryByRevision(history, selectedTaskInfo.task.revisionCreatedAt, selectedTaskInfo.task.currentRevision);
    const existingHistory = filteredHistory.find(
      (h) => {
        const matchesHelper = selectedTaskInfo.task.isHelper ? h.isSupportReport === true : h.isSupportReport !== true;
        return h.date?.split("T")[0] === reportDate && matchesHelper;
      }
    );
    if (existingHistory && !isEditingExisting) {
      alert(
        `คุณเคยส่งรายงานของวันที่ ${formatDate(reportDate)} ไปแล้วในใบงานนี้ หากต้องการแก้ไขกรุณากดปุ่มแก้ไขข้อมูล`,
      );
      return;
    }

    // 🚨 Cross-task labor overlap validation to prevent double-billing of worker wages
    const duplicateWorkers: string[] = [];
    labor.forEach((l) => {
      const idToCheck = l.staffId || l.contractorId;
      if (!idToCheck) return;

      workOrders.forEach((wo) => {
        wo.categories.forEach((cat: any) => {
          cat.tasks.forEach((t: any) => {
            // Skip checking the current task itself
            if (t.id === selectedTaskInfo.task.id) return;

            // Find history entry for this task on the same date
            const reportedOnDate = t.history?.find(
              (h: any) => h.revisionId === (t.currentRevision || 'rev00') && h.date?.split("T")[0] === reportDate
            );

            if (reportedOnDate && reportedOnDate.labor) {
              const matchingWorker = reportedOnDate.labor.find(
                (w: any) => w.workerId === idToCheck || w.staffId === idToCheck || w.contractorId === idToCheck
              );

              if (matchingWorker) {
                // Check if any shift times overlap
                const hasNormalOverlap = l.shifts?.normal && matchingWorker.shifts?.normal;
                const hasOtMorningOverlap = l.shifts?.otMorning && matchingWorker.shifts?.otMorning;
                const hasOtNoonOverlap = l.shifts?.otNoon && matchingWorker.shifts?.otNoon;
                const hasOtEveningOverlap = l.shifts?.otEvening && matchingWorker.shifts?.otEvening;

                if (hasNormalOverlap || hasOtMorningOverlap || hasOtNoonOverlap || hasOtEveningOverlap) {
                  const workerName = l.staffName || (l as any).name || l.affiliation || idToCheck;
                  const taskNameClean = (t.name || t.taskName || t.id).replace(/\s*\(REV\.\s*\d+\)/gi, '').trim();
                  
                  const overlappingShifts: string[] = [];
                  if (hasNormalOverlap) overlappingShifts.push("กะปกติ");
                  if (hasOtMorningOverlap) overlappingShifts.push("OT เช้า");
                  if (hasOtNoonOverlap) overlappingShifts.push("OT เที่ยง");
                  if (hasOtEveningOverlap) overlappingShifts.push("OT เย็น");

                  duplicateWorkers.push(`${workerName} ในงาน "${taskNameClean}" (${overlappingShifts.join(", ")})`);
                }
              }
            }
          });
        });
      });
    });

    if (duplicateWorkers.length > 0) {
      alert(`ไม่สามารถบันทึกรายงานได้ เนื่องจากมีคนงานปฏิบัติงานซ้ำซ้อนในวันและกะเวลาเดียวกัน:\n- ${duplicateWorkers.join('\n- ')}`);
      return;
    }

    setShowSummaryModal(true);
  };

  const handleFinalSubmit = async () => {
    if (submittingRef.current || isSubmitting) return;
    if (!selectedTaskInfo) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const history = selectedTaskInfo.task.history || [];
      const filteredHistory = filterHistoryByRevision(history, selectedTaskInfo.task.revisionCreatedAt, selectedTaskInfo.task.currentRevision);
      const existingHistory = filteredHistory.find(
        (h) => {
          const matchesHelper = selectedTaskInfo.task.isHelper ? h.isSupportReport === true : h.isSupportReport !== true;
          return h.date?.split("T")[0] === reportDate && matchesHelper;
        }
      );
      const laborPayload = labor
        .filter(
          (l) =>
            l.shifts?.normal ||
            l.shifts?.otMorning ||
            l.shifts?.otNoon ||
            l.shifts?.otEvening,
        )
        .map((l) => ({
          membership: l.membership || "Internal",
          workerId: l.staffId || l.contractorId || l.id,
          workerName: l.staffName || l.affiliation || "",
          staffId: l.staffId || "",
          staffName: l.staffName || "",
          contractorId: l.contractorId || "",
          employeeId: l.employeeId || "",
          shiftTimes: {
            day: l.shifts?.normal ? l.shiftTimes?.day || "08:00 - 17:00" : null,
            otEvening: l.shifts?.otEvening
              ? l.shiftTimes?.otEvening || "18:00 - 21:00"
              : null,
            otMorning: l.shifts?.otMorning
              ? l.shiftTimes?.otMorning || "06:00 - 08:00"
              : null,
            otNoon: l.shifts?.otNoon ? "12:00 - 13:00" : null,
          },
          shifts: {
            normal: l.shifts?.normal || false,
            otEvening: l.shifts?.otEvening || false,
            otMorning: l.shifts?.otMorning || false,
            otNoon: l.shifts?.otNoon || false,
          },
          expectedShifts: {
            normal: l.shifts?.normal || false,
            otEvening: l.shifts?.otEvening || false,
            otMorning: l.shifts?.otMorning || false,
            otNoon: l.shifts?.otNoon || false,
          },
          expectedHours: {
            normal: l.shifts?.normal ? calculateWorkingHours(l.shiftTimes?.day || "08:00 - 17:00") : 0,
            otMorning: l.shifts?.otMorning ? 2 : 0,
            otNoon: l.shifts?.otNoon ? 1 : 0,
            otEvening: l.shifts?.otEvening ? 3 : 0,
          },
          amount: l.amount || 1,
          recordedBy: l.recordedBy || foremanEmpId,
        }));
      const leavePayload = labor
        .filter((l) => l.leave?.active)
        .map((l) => ({
          workerId: l.staffId || l.id,
          workerName: l.staffName || "",
          employeeId: l.employeeId || "",
          leaveTimes: {
            custom: l.leave?.time || "08:00 - 17:00",
          },
          leaveShifts: {
            custom: true,
          },
          medCertFileUrl: l.leave?.medCertFileUrl || "",
          leaveType: l.leave?.medCertFileUrl ? "paid" : "unpaid",
          recordedBy: l.recordedBy || foremanEmpId,
        }));
      const photosPayload = {
        site: sitePhotos.filter(Boolean),
        laborByShift: {
          regular: laborRegularPhotos.some(Boolean)
            ? laborRegularPhotos.slice(0, 4)
            : null,
          otMorning:
            laborOtMorningPhotos[0] || laborOtMorningPhotos[1]
              ? {
                  in: laborOtMorningPhotos[0] || "",
                  out: laborOtMorningPhotos[1] || "",
                }
              : null,
          otNoon:
            laborOtNoonPhotos[0] || laborOtNoonPhotos[1]
              ? {
                  in: laborOtNoonPhotos[0] || "",
                  out: laborOtNoonPhotos[1] || "",
                }
              : null,
          otEvening:
            laborOtEveningPhotos[0] || laborOtEveningPhotos[1]
              ? {
                  in: laborOtEveningPhotos[0] || "",
                  out: laborOtEveningPhotos[1] || "",
                }
              : null,
        },
      };
      const foremanEmpId = user?.employeeId || user?.id || "101527";
      let updatedEditHistory = existingHistory?.editHistory || [];
      if (isEditingExisting && existingHistory) {
        const prevSnapshot = {
          labor: existingHistory.labor || [],
          leave: existingHistory.leave || [],
          photos: existingHistory.photos || null,
          note: existingHistory.note || "",
          progress: existingHistory.progress || 0,
          serverTimestamp:
            existingHistory.serverTimestamp || existingHistory.date || "",
        };
        const editRecord: EditHistoryRecord = {
          editedAt: new Date().toISOString(),
          editedBy: foremanEmpId,
          snapshot: prevSnapshot,
        };
        updatedEditHistory = [...updatedEditHistory, editRecord];
      }
      const isWoaWop =
        selectedTaskInfo.wo.id.toUpperCase().includes("WOA") ||
        selectedTaskInfo.wo.id.toUpperCase().includes("WOP");
      const updateId = isWoaWop
        ? reportDate
        : isEditingExisting && existingHistory
          ? existingHistory.id
          : `h-${Date.now()}`;
      const newUpdate = {
        id: updateId,
        date: `${reportDate}T${new Date().toISOString().split("T")[1]}`,
        note,
        progress,
        photos: photosPayload,
        labor: laborPayload,
        leave: leavePayload,
        type: reportType,
        projectLocationId: selectedTaskInfo.wo.projectId || "",
        ...(updatedEditHistory.length > 0
          ? { editHistory: updatedEditHistory }
          : {}),
        createdBy:
          isEditingExisting && existingHistory
            ? existingHistory.createdBy || foremanEmpId
            : foremanEmpId,
        createdAt:
          isEditingExisting && existingHistory
            ? existingHistory.createdAt || new Date().toISOString()
            : new Date().toISOString(),
        updatedBy: foremanEmpId,
        updatedAt: new Date().toISOString(),
      };
      if (isReportDatePast3Days) {
        await submitRetroactiveRequest(
          selectedTaskInfo.wo.id,
          selectedTaskInfo.categoryId,
          selectedTaskInfo.task.id,
          reportDate,
          {
            progress: newUpdate.progress,
            note: newUpdate.note,
            type: newUpdate.type as string,
            labor: newUpdate.labor,
            leave: newUpdate.leave,
            photos: newUpdate.photos,
          },
          { uid: user?.id || foremanEmpId, name: (user as any)?.name || (user as any)?.displayName || 'โฟรแมน' }
        );
        setRetroactiveSubmitDone(true);
        setShowSummaryModal(false);
        // Save pending draft so form data persists while waiting for approval
        try {
          const _isWoa = selectedTaskInfo.wo.id.toUpperCase().includes("WOA") || selectedTaskInfo.wo.id.toUpperCase().includes("WOP");
          const _woId = selectedTaskInfo.wo.id;
          const _catId = selectedTaskInfo.categoryId;
          const _tId = selectedTaskInfo.task.id;
          const _subId = _tId.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
          const _taskDoc = workOrders.find(w => w?.id === _woId)?.categories?.find((c: any) => c?.id === _catId)?.tasks?.find((t: any) => t?.id === _tId);
          const _rev = _taskDoc?.currentRevision || "rev00";
          const _draftRef = _isWoa
            ? doc(db, "workOrders", _woId, "categories", _catId, "tasks", _tId, "subtasks", _subId, "revisions", _rev, "dailyReportsDraft", reportDate)
            : doc(db, "workOrders", _woId, "categories", _catId, "tasks", _tId, "dailyreportDraft", reportDate);
          await setDoc(_draftRef, {
            progress, note, labor, reportType, reportDate,
            sitePhotos: sitePhotos.filter(Boolean),
            laborRegularPhotos, laborOtMorningPhotos, laborOtNoonPhotos, laborOtEveningPhotos,
            isPendingRetroactive: true,
            updatedAt: new Date().toISOString(),
          });
        } catch (_e) { console.error("saveRetroactiveDraft failed:", _e); }
        try {
          await sendNotification({
            recipientRole: 'Admin',
            senderId: user?.id || foremanEmpId,
            senderName: (user as any)?.name || (user as any)?.displayName || 'โฟรแมน',
            title: 'คำขอรับรองข้อมูลย้อนหลัง',
            message: `${(user as any)?.name || 'โฟรแมน'} ขอรับรองข้อมูลวันที่ ${reportDate} (${selectedTaskInfo.wo.id}) — กรุณาตรวจสอบ`,
            type: 'warning',
            targetPath: '/evaluation',
          });
        } catch (_) {}
        return;
      }
      await addTaskUpdate(
        selectedTaskInfo.wo.id,
        selectedTaskInfo.categoryId,
        selectedTaskInfo.task.id,
        newUpdate as any,
      );

      // ลบแบบร่าง (Draft) ออกจากระบบเมื่อทำการส่งรายงานผลสำเร็จ
      try {
        const isWoaWop =
          selectedTaskInfo.wo.id.toUpperCase().includes("WOA") ||
          selectedTaskInfo.wo.id.toUpperCase().includes("WOP");
        const workOrderId = selectedTaskInfo.wo.id;
        const categoryId = selectedTaskInfo.categoryId;
        const taskId = selectedTaskInfo.task.id;
        const getSubtaskId = (tId: string): string => {
          if (tId) {
            return tId.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
          }
          return tId;
        };
        const subtaskId = getSubtaskId(taskId);
        const taskDoc = workOrders.find((w) => w?.id === workOrderId)?.categories?.find((c: any) => c?.id === categoryId)?.tasks?.find((t: any) => t?.id === taskId);
        const currentRev = taskDoc?.currentRevision || "rev00";
        let draftDocRef;
        if (isWoaWop) {
          if (selectedTaskInfo.task.isHelper) {
            const helpId = currentRev.replace('rev', 'help');
            draftDocRef = doc(db, "workOrders", workOrderId, "categories", categoryId, "tasks", taskId, "subtasks", subtaskId, "help", helpId, "dailyReportsDraft", reportDate);
          } else {
            draftDocRef = doc(db, "workOrders", workOrderId, "categories", categoryId, "tasks", taskId, "subtasks", subtaskId, "revisions", currentRev, "dailyReportsDraft", reportDate);
          }
        } else {
          draftDocRef = doc(db, "workOrders", workOrderId, "categories", categoryId, "tasks", taskId, "dailyreportDraft", reportDate);
        }
        await deleteDoc(draftDocRef);
      } catch (deleteErr) {
        console.error("Failed to delete draft:", deleteErr);
      }

      alert("บันทึกรายงานเรียบร้อยแล้ว");
      setDraftedTaskIds(prev => {
        const next = new Set(prev);
        next.delete(selectedTaskInfo.task.id);
        sessionStorage.setItem('draftedTaskIds', JSON.stringify([...next]));
        return next;
      });
      setShowSummaryModal(false);
      if (existingHistory) {
        setIsEditingExisting(false);
      } else {
        setSelectedTaskInfo(null);
        setProgress(0);
        setNote("");
        setLabor([]);
        setSitePhotos([]);
        setLaborRegularPhotos([]);
        setLaborOtMorningPhotos([]);
        setLaborOtNoonPhotos([]);
        setLaborOtEveningPhotos([]);
        setReportType("Update");
        setReportDate(new Date().toISOString().split("T")[0]);
      }
    } catch (error: any) {
      console.error("Submit failed:", error);
      if (error?.message === 'DUPLICATE_PENDING') {
        alert("มีคำขอรับรองสำหรับวันนี้รออยู่แล้ว กรุณารอการรับรองก่อน");
        setRetroactiveSubmitDone(true);
        setShowSummaryModal(false);
      } else {
        alert("บันทึกรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (submittingRef.current || isSubmitting) return;
    if (!selectedTaskInfo) return;
    setIsSubmitting(true);
    try {
      const isWoaWop =
        selectedTaskInfo.wo.id.toUpperCase().includes("WOA") ||
        selectedTaskInfo.wo.id.toUpperCase().includes("WOP");
      const workOrderId = selectedTaskInfo.wo.id;
      const categoryId = selectedTaskInfo.categoryId;
      const taskId = selectedTaskInfo.task.id;
      const getSubtaskId = (tId: string): string => {
        if (tId) {
          return tId.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
        }
        return tId;
      };
      const subtaskId = getSubtaskId(taskId);
      const taskDoc = workOrders.find((w) => w?.id === workOrderId)?.categories?.find((c: any) => c?.id === categoryId)?.tasks?.find((t: any) => t?.id === taskId);
      const currentRev = taskDoc?.currentRevision || "rev00";

      const draftPayload = {
        progress,
        note,
        labor,
        sitePhotos: sitePhotos.filter(Boolean),
        laborRegularPhotos,
        laborOtMorningPhotos,
        laborOtNoonPhotos,
        laborOtEveningPhotos,
        reportType,
        reportDate,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.employeeId || user?.id || "unknown",
      };

      let draftDocRef;
      if (isWoaWop) {
        if (selectedTaskInfo.task.isHelper) {
          const helpId = currentRev.replace('rev', 'help');
          const helpDocRef = doc(db, "workOrders", workOrderId, "categories", categoryId, "tasks", taskId, "subtasks", subtaskId, "help", helpId);
          await setDoc(helpDocRef, { helpId, createdAt: new Date().toISOString() }, { merge: true });

          draftDocRef = doc(db, "workOrders", workOrderId, "categories", categoryId, "tasks", taskId, "subtasks", subtaskId, "help", helpId, "dailyReportsDraft", reportDate);
        } else {
          const revDocRef = doc(db, "workOrders", workOrderId, "categories", categoryId, "tasks", taskId, "subtasks", subtaskId, "revisions", currentRev);
          await setDoc(revDocRef, { revisionId: currentRev, createdAt: new Date().toISOString() }, { merge: true });

          draftDocRef = doc(db, "workOrders", workOrderId, "categories", categoryId, "tasks", taskId, "subtasks", subtaskId, "revisions", currentRev, "dailyReportsDraft", reportDate);
        }
      } else {
        draftDocRef = doc(db, "workOrders", workOrderId, "categories", categoryId, "tasks", taskId, "dailyreportDraft", reportDate);
      }

      await setDoc(draftDocRef, draftPayload);
      setDraftedTaskIds(prev => {
        const next = new Set(prev).add(taskId);
        sessionStorage.setItem('draftedTaskIds', JSON.stringify([...next]));
        return next;
      });
      alert("บันทึกแบบร่างเรียบร้อยแล้ว");
    } catch (error) {
      console.error("Save draft failed:", error);
      alert("บันทึกแบบร่างไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    if (!selectedTaskInfo) return;
    const confirmCancel = window.confirm(
      "คุณต้องการยกเลิกการแก้ไขใช่หรือไม่? การเปลี่ยนแปลงทั้งหมดที่ยังไม่ได้บันทึกจะสูญหาย",
    );
    if (!confirmCancel) return;
    const history = selectedTaskInfo.task.history || [];
    const filteredHistory = filterHistoryByRevision(history, selectedTaskInfo.task.revisionCreatedAt, selectedTaskInfo.task.currentRevision);
    const existingReport = filteredHistory.find(
      (h) => {
        const matchesHelper = selectedTaskInfo.task.isHelper ? h.isSupportReport === true : h.isSupportReport !== true;
        return h.date?.split("T")[0] === reportDate && matchesHelper;
      }
    );
    if (existingReport) {
      setProgress(existingReport.progress);
      setNote(existingReport.note || "");
      const mergedLabor: LaborEntry[] = [];
      const laborMap = new Map<string, HistoryLaborEntry>();
      const leaveMap = new Map<string, HistoryLeaveEntry>();
      if (existingReport.labor) {
        existingReport.labor.forEach((l: any) =>
          laborMap.set(l.workerId || l.id || "", l),
        );
      }
      const exLeave = existingReport.leave;
      if (exLeave) {
        exLeave.forEach((l: any) => leaveMap.set(l.workerId || l.id || "", l));
      }
      const allWorkerIds = Array.from(
        new Set([...laborMap.keys(), ...leaveMap.keys()]),
      );
      allWorkerIds.forEach((wId) => {
        const l = laborMap.get(wId);
        const lv = leaveMap.get(wId);
        const isInternal =
          wId.startsWith("DC-") ||
          (l && !l.contractorId) ||
          (lv && !lv.contractorId);
        mergedLabor.push({
          id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          membership: isInternal ? "Internal" : "Outsource",
          staffId: wId,
          staffName:
            l?.staffName ||
            l?.workerName ||
            lv?.staffName ||
            lv?.workerName ||
            "",
          employeeId: l?.employeeId || lv?.employeeId || "",
          affiliation:
            l?.staffName || l?.workerName
              ? isInternal
                ? l?.staffName || l?.workerName || "General"
                : l?.staffName || l?.workerName || "General"
              : lv?.staffName || lv?.workerName || "General",
          amount: Number(l?.amount) || 1,
          timeType: "Normal",
          shifts: {
            normal: l?.shifts?.normal || false,
            otMorning: l?.shifts?.otMorning || false,
            otNoon: l?.shifts?.otNoon || false,
            otEvening: l?.shifts?.otEvening || false,
          },
          shiftTimes: {
            day: l?.shiftTimes?.day || "08:00 - 17:00",
            otMorning: l?.shiftTimes?.otMorning || "06:00 - 08:00",
            otNoon: "12:00 - 13:00",
            otEvening: l?.shiftTimes?.otEvening || "18:00 - 21:00",
          },
          leave: {
            active: lv?.leaveShifts?.custom || false,
            time: lv?.leaveTimes?.custom || "08:00 - 17:00",
            medCertFileUrl: lv?.medCertFileUrl || "",
          },
          recordedBy: l?.recordedBy || lv?.recordedBy || "",
        });
      });
      setLabor(mergedLabor);
      const mapRegularFromDb = (dbShift: any): (string | null)[] => {
        if (!dbShift) return [];
        if (Array.isArray(dbShift))
          return [
            dbShift[0] || "",
            dbShift[1] || "",
            dbShift[2] || "",
            dbShift[3] || "",
          ];
        return [
          dbShift.in || "",
          dbShift.lunch || "",
          dbShift.afternoon || "",
          dbShift.out || "",
        ];
      };
      const mapOtShiftFromDb = (dbShift: any): (string | null)[] => {
        if (!dbShift) return [];
        if (Array.isArray(dbShift)) return [dbShift[0] || "", dbShift[1] || ""];
        return [dbShift.in || "", dbShift.out || ""];
      };
      if (existingReport.photos && !Array.isArray(existingReport.photos)) {
        const pObj = existingReport.photos as HistoryPhotos;
        setSitePhotos(pObj.site || []);
        setLaborRegularPhotos(mapRegularFromDb(pObj.laborByShift?.regular));
        setLaborOtMorningPhotos(mapOtShiftFromDb(pObj.laborByShift?.otMorning));
        setLaborOtNoonPhotos(mapOtShiftFromDb(pObj.laborByShift?.otNoon));
        setLaborOtEveningPhotos(mapOtShiftFromDb(pObj.laborByShift?.otEvening));
      } else {
        const pArr = (existingReport.photos as string[]) || [];
        setSitePhotos(pArr);
        setLaborRegularPhotos(existingReport.laborPhotos || []);
        setLaborOtMorningPhotos([]);
        setLaborOtNoonPhotos([]);
        setLaborOtEveningPhotos([]);
      }
      setActivePhotoTab("site");
    }
    setIsEditingExisting(false);
  };

  const handleDateChange = (newDateStr: string) => {
    if (newDateStr === reportDate) return;
    if (hasUnsavedChanges) {
      const discard = window.confirm(
        "คุณมีรายการที่ยังไม่ได้บันทึกค้างอยู่ หากเปลี่ยนวันที่ การเปลี่ยนแปลงทั้งหมดในหน้านี้จะสูญหาย คุณต้องการเปลี่ยนวันโดยละทิ้งการแก้ไขใช่หรือไม่?",
      );
      if (!discard) return;
    }
    setReportDate(newDateStr);
  };


  const availableStaff = dailyContractors
    .filter((c) => (c.department || "").toLowerCase().endsWith("wh"))
    .filter((c) => !labor.some((l) => l.staffId === c.id));

  const availableContractors = realContractors.filter(
    (c) => !labor.some((l) => l.contractorId === c.id),
  );

  return (
    <DailyReportContext.Provider
      value={{
        workOrders,
        user,
        sendNotification,
        navigate,
        location,
        foremanId,
        highlightedId,
        setHighlightedId,
        selectedTaskInfo,
        setSelectedTaskInfo,
        isTaskFinished,
        searchTerm,
        setSearchTerm,
        progress,
        setProgress,
        note,
        setNote,
        labor,
        setLabor,
        sitePhotos,
        setSitePhotos,
        laborRegularPhotos,
        setLaborRegularPhotos,
        laborOtMorningPhotos,
        setLaborOtMorningPhotos,
        laborOtNoonPhotos,
        setLaborOtNoonPhotos,
        laborOtEveningPhotos,
        setLaborOtEveningPhotos,
        activePhotoTab,
        setActivePhotoTab,
        zoomImage,
        setZoomImage,
        isSidebarOpen,
        setIsSidebarOpen,
        showCalendarDropdown,
        setShowCalendarDropdown,
        showUnlockModal,
        setShowUnlockModal,
        pendingUnlockDate,
        setPendingUnlockDate,
        unlockReason,
        setUnlockReason,
        calendarYear,
        setCalendarYear,
        calendarMonth,
        setCalendarMonth,
        isEditingExisting,
        setIsEditingExisting,
        showSummaryModal,
        setShowSummaryModal,
        collapsedHelpers,
        setCollapsedHelpers,
        isUploading,
        setIsUploading,
        uploadingLeaveCertId,
        setUploadingLeaveCertId,
        isSubmitting,
        setIsSubmitting,
        submittingRef,
        retroactiveSubmitDone,
        setRetroactiveSubmitDone,
        activeModal,
        setActiveModal,
        timePickerTarget,
        setTimePickerTarget,
        reportType,
        setReportType,
        reportDate,
        setReportDate,
        realContractors,
        realProjects,
        dailyContractors,
        modalAlert,
        setModalAlert,
        isReviewModalOpen,
        setIsReviewModalOpen,
        reviewTaskInfo,
        setReviewTaskInfo,
        isCustomerMockupOpen,
        setIsCustomerMockupOpen,
        mockupWorkOrder,
        setMockupWorkOrder,
        
        availableStaff,
        availableContractors,
        newTasks,
        inProgressTasks,
        pendingInspectionTasks,
        pendingDeliveryWorkOrders,
        
        addTaskUpdate,
        updateTask,
        updateWorkOrderStatus,
        requestRetroactiveUnlock,
        submitRetroactiveRequest,
        generateDeliveryQrToken,
        submitCustomerInspection,
        
        handleSelectTask,
        handleBatchAdd,
        handleTimeChange,
        handleRemoveSlotPhoto,
        handleSlotPhotoUpload,
        handleUploadLeaveCert,
        handleRemoveLeaveCert,
        handleConfirmReview,
        handleBounceBackSLA,
        handleSubmit,
        handleFinalSubmit,
        handleSaveDraft,
        handleCancelEdit,
        handleDateChange,
        
        toggleShift,
        getDateStatus,
        isProgressNotePhotosEditable,
        hasHistoryForSelectedDate,
        getTaskImage,
        openTimePicker,
        
        isReportDatePast3Days,
        isTimeOverlap,
        progressBounds,
        draftedTaskIds,
      }}
    >
      {children}
    </DailyReportContext.Provider>
  );
};

export const useDailyReport = () => {
  const context = useContext(DailyReportContext);
  if (context === undefined) {
    throw new Error("useDailyReport must be used within a DailyReportProvider");
  }
  return context;
};
