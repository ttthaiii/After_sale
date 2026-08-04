import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from "react";
import { db, storage } from "../lib/firebase";
import { todayTH } from "../lib/dateUtils";
import { collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, updateDoc, getDocs, runTransaction } from "firebase/firestore";
import { useWorkOrders } from "./WorkOrderContext";
import { useAuth } from "./AuthContext";
import { useNotifications } from "./NotificationContext";
import { useAlert } from "./AlertContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { compressImage } from "../utils/imageCompression";
import { formatDate } from "../utils/date";
import { isWoaWop as isWoaWopType } from "../utils/workOrder";
import { useNavigate, useLocation } from "react-router-dom";
import { logService } from "../services/logService";
import { useStableCallbacks } from "../hooks/useStableCallbacks";
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
  preHandoverWorkOrders: { wo: any; assignedCategories: any[] }[];
  updatePhCategoryProgress: (woId: string, catId: string, progress: number) => Promise<void>;

  // PreHandover Detail Pane
  selectedPhCatInfo: { wo: any; cat: any } | null;
  setSelectedPhCatInfo: React.Dispatch<React.SetStateAction<{ wo: any; cat: any } | null>>;
  selectPhCatInfo: (info: { wo: any; cat: any } | null) => void;
  hasPhUnsavedChanges: boolean;
  showPhSummaryModal: boolean;
  setShowPhSummaryModal: React.Dispatch<React.SetStateAction<boolean>>;
  phDailyHistory: any[];
  phProgressBounds: { min: number; max: number; isToday: boolean };
  submitPhDailyReport: (noteType?: string) => Promise<void>;
  savePhDraft: () => Promise<void>;
  phDraftedDates: Set<string>;
  getPhDateStatus: (dateStr: string) => "disabled" | "reported" | "unlocked" | "locked";
  isPhReportDatePast3Days: boolean;
  phRetroactiveSubmitDone: boolean;
  setPhRetroactiveSubmitDone: React.Dispatch<React.SetStateAction<boolean>>;
  submitPhRetroactiveRequest: () => Promise<void>;
  isPhEditingExisting: boolean;
  setIsPhEditingExisting: React.Dispatch<React.SetStateAction<boolean>>;
  isPhExistingReport: boolean;
  
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
  handleSlotPhotoUpload: (tab: string, index: number, file: File | undefined) => Promise<void>;
  handleSitePhotosUpload: (files: FileList | null) => Promise<void>;
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
  togglePhShift: (laborId: string, shiftKey: keyof ShiftConfig) => void;
  getDateStatus: (dateStr: string, task: WorkTask) => "disabled" | "reported" | "unlocked" | "locked";
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

// Persisted labor payloads never include `id` (it's a UI-only field), so any
// labor array loaded straight from a saved report/draft has every entry's id
// missing. The per-row delete button filters by `item.id !== l.id` — with all
// ids undefined that filter drops every row instead of just the clicked one
// (feedback 2026-08-04). Stamp a fresh unique id onto anything that lacks one
// right after loading, before it ever reaches setLabor.
export const ensureLaborIds = (list: any[]): any[] =>
  (list || []).map((l) => ({
    ...l,
    id: l.id || `L-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  }));

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
    projects,
    contractors,
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
  const showAlert = useAlert();
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
    todayTH(),
  );
  // T-craft (2026-07-23): realContractors/realProjects previously had their own onSnapshot
  // listeners here, duplicating WorkOrderContext's `contractors`/`projects` listeners on the
  // exact same collections. WorkOrderContext is always an ancestor provider (DailyReportProvider
  // reads from useWorkOrders() below), so just alias its values instead of double-listening.
  // Project ⊇ RealProject and Contractor ⊇ RealContractor structurally (same id/name fields),
  // so this is a type-safe narrowing, not a behavior change.
  const realContractors: RealContractor[] = contractors;
  const realProjects: RealProject[] = projects;
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
    const todayStr = todayTH();
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
    // contractors/projects now come from WorkOrderContext (see realContractors/realProjects
    // aliases above) — only dailyContractors still needs its own listener here.
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
      // A draft entry (status: 'draft') isn't finalized yet — resume straight into
      // edit mode like the old shadow-draft flow did, no extra "แก้ไขข้อมูล" click
      // needed. A real submitted entry still requires that explicit edit step.
      setIsEditingExisting((existingReport as any).status === 'draft' && !isTaskFinished);
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
        const isToday = reportDate === todayTH();
        min = isToday ? (selectedTaskInfo.task.dailyProgress || 0) : 0;
      }
      
      const defaultProgress = min > 0 ? min + 1 : 0;

      const checkAndLoadDraft = async () => {
        try {
          const isWoaWop = isWoaWopType(selectedTaskInfo.wo);
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
            setLabor(ensureLaborIds(draftData.labor || []));
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
    preHandoverWorkOrders,
  } = useMemo(() => {
    const _newTasks: TaskListItem[] = [];
    const _inProgressTasks: TaskListItem[] = [];
    const _pendingInspectionTasks: TaskListItem[] = [];
    const _pendingDeliveryWOs: PendingDeliveryItem[] = [];
    const _preHandoverWOs: { wo: any; assignedCategories: any[] }[] = [];
    workOrders.forEach((wo) => {
      if (["Draft", "Cancelled", "Complete", "Verified"].includes(wo.status))
        return;

      if (wo.type === 'PreHandover') {
        const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';
        const assignedCats = isAdminOrManager
          ? wo.categories
          : wo.categories.filter((cat: any) =>
              cat.assignedForemanId === foremanId ||
              cat.assignedForemanId === user?.id ||
              cat.assignedForemanId === user?.employeeId
            );
        if (assignedCats.length > 0) {
          _preHandoverWOs.push({ wo, assignedCategories: assignedCats });
        }
        return;
      }
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
      // A task sitting at 100% via a still-open draft (progressStatus: 'draft')
      // must NOT count toward "all done" — that would surface the WO for
      // customer QR/delivery before the foreman has actually finalized it
      // (user-confirmed 2026-07-24). Missing progressStatus = legacy/submitted.
      const globalIsAllCompleted =
        globalTasks.length > 0 &&
        globalTasks.every(
          (t: any) => (t.dailyProgress ?? t.progress ?? 0) === 100 && t.progressStatus !== 'draft'
        );

      const isGroupedDelivery =
        ["pending_delivery", "Rejected"].includes(wo.status) ||
        globalIsAllCompleted;

      if (isParticipant && isGroupedDelivery) {
        _pendingDeliveryWOs.push({ wo });
      } else {
        woTasksList.forEach((item) => {
          // A draft-only 100% (progressStatus: 'draft') stays "in progress" —
          // it's not really done until the foreman finalizes it (user-confirmed
          // 2026-07-24).
          if (item.task.dailyProgress === 100 && (item.task as any).progressStatus !== 'draft') {
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
      preHandoverWorkOrders: _preHandoverWOs,
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
          if (wo.status === "Complete") {
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
                globalTasks.find((t: any) => t.status === "Rejected") ||
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
    if (hasUnsavedChanges || hasPhUnsavedChanges) {
      const confirmLeave = window.confirm(
        "คุณมีข้อมูลรายงานความคืบหน้าที่ยังไม่ได้บันทึกค้างอยู่ หากเปลี่ยนงาน ข้อมูลที่กรอกไว้ทั้งหมดจะสูญหาย\n\nต้องการเปลี่ยนงานหรือไม่?"
      );
      if (!confirmLeave) {
        return;
      }
    }

    const history = task.history || [];
    const todayStr = todayTH();
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
    setSelectedPhCatInfo(null);
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
    setReportDate(todayTH());
  };

  const getDateStatus = (dateStr: string, task: WorkTask) => {
    const todayStr = todayTH();
    if (dateStr > todayStr) {
      return "disabled";
    }
    // No floor at wo.startDate/createdAt (user 2026-07-24): work can predate
    // when the WO was opened in the system. Dates before opening now fall
    // through to the same locked/unlocked rule as any other past date —
    // >3 days ago requires the existing retroactive-request/admin-approve flow.
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
    const isToday = reportDate === todayTH();
    // max is bounded ONLY by an actual future entry's progress (loop above) —
    // no blanket cap for backdated dates; a day with no later entry yet can
    // still be closed at 100% (user-confirmed correction 2026-07-23).
    return { min, max, isToday };
  }, [selectedTaskInfo, reportDate]);

  const isReportDatePast3Days = useMemo(() => {
    if (!selectedTaskInfo) return false;
    const todayStr = todayTH();
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

  // Atomically claims per-worker/date/shift slots via a Firestore transaction —
  // closes the race window the pre-submit client-side duplicate check cannot:
  // that check reads possibly-stale in-memory `workOrders` state, so two
  // foremen submitting for the same worker at nearly the same time could both
  // pass it. This re-checks + reserves the slots inside one transaction right
  // before the real write, so whichever submit commits second sees the
  // first's claim and is rejected. Shared by both WOA (handleFinalSubmit) and
  // WOP (submitPhDailyReport) — user-confirmed both must enforce this equally.
  // Throws an Error with code 'LABOR_DAY_LOCK_CONFLICT' (message = Thai alert
  // text) on conflict; callers must catch it and showAlert(error.message).
  const claimLaborDayLocks = async (
    laborList: LaborEntry[],
    reportDate: string,
    workOrderId: string,
    taskId: string,
    taskName: string,
    previousLaborList: LaborEntry[] = [],
  ) => {
    const DEFAULT_SHIFT_TIME: Record<string, string> = {
      normal: "08:00 - 17:00",
      otMorning: "06:00 - 08:00",
      otNoon: "12:00 - 13:00",
      otEvening: "18:00 - 21:00",
    };
    const SHIFT_TIME_KEY: Record<string, keyof NonNullable<LaborEntry["shiftTimes"]>> = {
      normal: "day",
      otMorning: "otMorning",
      otNoon: "otNoon",
      otEvening: "otEvening",
    };
    const SHIFT_LABEL: Record<string, string> = {
      normal: "กะปกติ",
      otMorning: "OT เช้า",
      otNoon: "OT เที่ยง",
      otEvening: "OT เย็น",
    };
    const getShiftTime = (entry: any, shiftKey: string) =>
      entry.shiftTimes?.[SHIFT_TIME_KEY[shiftKey]] || DEFAULT_SHIFT_TIME[shiftKey];

    const claimants = laborList
      .map((l) => ({
        workerId: l.staffId || l.contractorId,
        workerName: l.staffName || (l as any).name || l.affiliation || l.staffId || l.contractorId || "",
        shifts: (["normal", "otMorning", "otNoon", "otEvening"] as const)
          .filter((k) => l.shifts?.[k])
          .map((k) => ({ shiftKey: k, timeRange: getShiftTime(l, k) })),
      }))
      .filter((c) => c.workerId && c.shifts.length > 0);

    // Workers who were on this task's previously-saved report but were removed
    // in this edit (e.g. taken off to be reassigned elsewhere) never get their
    // own loop iteration below — their day-lock claim for this task would
    // otherwise linger forever and falsely block them from being added to a
    // new task on the same day (feedback 2026-08-04).
    const currentWorkerIds = new Set(claimants.map((c) => c.workerId));
    const removedWorkerIds = Array.from(
      new Set(
        previousLaborList
          .map((l) => l.staffId || l.contractorId)
          .filter((id): id is string => !!id && !currentWorkerIds.has(id)),
      ),
    );

    if (claimants.length === 0 && removedWorkerIds.length === 0) return;

    await runTransaction(db, async (transaction) => {
      const conflicts: string[] = [];
      const writes: { ref: any; claims: any[] }[] = [];

      for (const claimant of claimants) {
        const lockRef = doc(db, "laborDayLocks", `${claimant.workerId}_${reportDate}`);
        const snap = await transaction.get(lockRef);
        const existingClaims: any[] = (snap.exists() ? (snap.data() as any).claims : []) || [];

        // Drop this same task's own previous claims first — re-submitting/
        // editing this task's own report replaces its slot, not a collision.
        const otherTaskClaims = existingClaims.filter(
          (c) => !(c.workOrderId === workOrderId && c.taskId === taskId)
        );

        claimant.shifts.forEach(({ shiftKey, timeRange }) => {
          const collision = otherTaskClaims.find((c) => isTimeOverlap(c.timeRange, timeRange));
          if (collision) {
            conflicts.push(`${claimant.workerName} (${SHIFT_LABEL[shiftKey]}) ซ้ำกับงาน "${collision.taskName}"`);
          }
        });

        const newClaims = [
          ...otherTaskClaims,
          ...claimant.shifts.map(({ shiftKey, timeRange }) => ({ workOrderId, taskId, taskName, shiftKey, timeRange })),
        ];
        writes.push({ ref: lockRef, claims: newClaims });
      }

      for (const workerId of removedWorkerIds) {
        const lockRef = doc(db, "laborDayLocks", `${workerId}_${reportDate}`);
        const snap = await transaction.get(lockRef);
        const existingClaims: any[] = (snap.exists() ? (snap.data() as any).claims : []) || [];
        const remainingClaims = existingClaims.filter(
          (c) => !(c.workOrderId === workOrderId && c.taskId === taskId)
        );
        if (remainingClaims.length !== existingClaims.length) {
          writes.push({ ref: lockRef, claims: remainingClaims });
        }
      }

      if (conflicts.length > 0) {
        const err: any = new Error(
          `ไม่สามารถบันทึกรายงานได้ เนื่องจากมีคนงานปฏิบัติงานซ้ำซ้อนในวันและกะเวลาเดียวกัน:\n- ${conflicts.join("\n- ")}`
        );
        err.code = "LABOR_DAY_LOCK_CONFLICT";
        throw err;
      }

      writes.forEach(({ ref, claims }) => transaction.set(ref, { claims, updatedAt: new Date().toISOString() }));
    });
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

  // WOP variant: uses isPhEditable guard (not isEditingExisting) — allows toggling on new reports
  const togglePhShift = (id: string, shiftKey: keyof ShiftConfig) => {
    const isPhEditable = !isPhExistingReport || isPhEditingExisting;
    if (!isPhEditable) return;
    setLabor((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const currentShifts = l.shifts || { normal: false, otMorning: false, otNoon: false, otEvening: false };
        const isActive = !currentShifts[shiftKey];
        let newShiftTimes = { ...(l.shiftTimes || {}) };
        if (isActive && l.membership === 'Internal') {
          if (shiftKey === 'otMorning' && !newShiftTimes.otMorning) newShiftTimes.otMorning = '06:00 - 08:00';
          if (shiftKey === 'otNoon'    && !newShiftTimes.otNoon)    newShiftTimes.otNoon    = '12:00 - 13:00';
          if (shiftKey === 'otEvening' && !newShiftTimes.otEvening) newShiftTimes.otEvening = '18:00 - 21:00';
        }
        let updatedShifts = { ...currentShifts, [shiftKey]: isActive };
        if (shiftKey === 'normal' && !isActive) {
          // Uncheck normal → also uncheck all OT
          updatedShifts.otMorning = false;
          updatedShifts.otNoon    = false;
          updatedShifts.otEvening = false;
        }
        return { ...l, shifts: updatedShifts, shiftTimes: newShiftTimes };
      }),
    );
  };

  const openTimePicker = (id: string, shift: string, type: "start" | "end") => {
    if (selectedPhCatInfo) {
      if (!isPhEditingExisting) return;
    } else {
      if (!isEditingExisting) return;
    }
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
    file: File | undefined,
  ) => {
    const targetWoId = selectedTaskInfo?.wo.id || selectedPhCatInfo?.wo.id;
    if (!file || !targetWoId) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `progress_${tab}_slot${slotIndex}_${Date.now()}.${fileExt}`;
      const storagePath = `work_orders/${targetWoId}/progress/${fileName}`;
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
      await showAlert("อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsUploading(false);
    }
  };

  // Site photos are an open-ended list (no fixed slots like the labor OT shifts), so
  // selecting several files at once just appends each one in turn under a single
  // isUploading flag instead of flickering it per file.
  const handleSitePhotosUpload = async (files: FileList | null) => {
    const targetWoId = selectedTaskInfo?.wo.id || selectedPhCatInfo?.wo.id;
    if (!files || files.length === 0 || !targetWoId) return;
    // Snapshot into a plain array synchronously, before any `await`. PhotoSourcePicker
    // resets the input's `value` right after calling onSelect — on some browsers that
    // clears the same live FileList in place, so reading files[i]/files.length after an
    // await here could see it already truncated mid-loop.
    const fileArray = Array.from(files);
    setIsUploading(true);
    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `progress_site_${Date.now()}_${i}.${fileExt}`;
        const storagePath = `work_orders/${targetWoId}/progress/${fileName}`;
        const storageRef = ref(storage, storagePath);
        const compressedFile = await compressImage(file, 1280, 0.7);
        const snapshot = await uploadBytes(storageRef, compressedFile, {
          cacheControl: "public, max-age=31536000",
          contentType: compressedFile.type || "image/jpeg",
        });
        const downloadURL = await getDownloadURL(snapshot.ref);
        setSitePhotos((prev) => [...prev, downloadURL]);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      await showAlert("อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsUploading(false);
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
      await showAlert("อัปโหลดใบรับรองแพทย์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
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
      if (status === "Complete") {
        await updateTask(woId, categoryId, taskId, {
          status: "Complete",
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
          // customer reject → task re-enters evaluation (rework loop); WO derives to customer_reject
          status: "Evaluating",
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
        status: "Evaluating",
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
      await showAlert("ตีกลับใบงานเรียบร้อยแล้ว");
      setSelectedTaskInfo(null);
    } catch (err) {
      console.error("Bounce back error:", err);
      await showAlert("เกิดข้อผิดพลาดในการตีกลับใบงาน");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (submittingRef.current || isSubmitting) return;
    if (!selectedTaskInfo) return;
    if (labor.length === 0) {
      await showAlert("กรุณาระบุข้อมูลแรงงานที่เข้าดำเนินการ");
      return;
    }
    if (!selectedTaskInfo.task.isHelper) {
      if (sitePhotos.filter(Boolean).length < 2) {
        await showAlert("กรุณาแนบรูปถ่ายหน้างานอย่างน้อย 2 รูป");
        return;
      }
      const isRegularActive = labor.some((l) => l.shifts?.normal);
      if (isRegularActive) {
        const requiredCount = getRequiredRegularPhotoCount(labor);
        const uploadedCount = laborRegularPhotos.filter(Boolean).length;
        if (uploadedCount < requiredCount) {
          if (requiredCount === 2) {
            await showAlert("กรุณาแนบรูปถ่ายแรงงานกะปกติให้ครบ 2 รูป (เข้า / ออก)");
            return;
          } else {
            await showAlert(
              "กรุณาแนบรูปถ่ายแรงงานกะปกติให้ครบ 4 รูป (เข้า / พักเที่ยง / เข้าบ่าย / ออก)",
            );
            return;
          }
        }
      }
      const isOtMorningActive = labor.some((l) => l.shifts?.otMorning);
      if (isOtMorningActive && laborOtMorningPhotos.filter(Boolean).length < 2) {
        await showAlert("กรุณาแนบรูปถ่ายแรงงาน OT เช้าให้ครบ 2 รูป (เข้า / ออก)");
        return;
      }
      const isOtNoonActive = labor.some((l) => l.shifts?.otNoon);
      if (isOtNoonActive && laborOtNoonPhotos.filter(Boolean).length < 2) {
        await showAlert("กรุณาแนบรูปถ่ายแรงงาน OT เที่ยงให้ครบ 2 รูป (เข้า / ออก)");
        return;
      }
      const isOtEveningActive = labor.some((l) => l.shifts?.otEvening);
      if (isOtEveningActive && laborOtEveningPhotos.filter(Boolean).length < 2) {
        await showAlert("กรุณาแนบรูปถ่ายแรงงาน OT เย็นให้ครบ 2 รูป (เข้า / ออก)");
        return;
      }
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
      await showAlert(
        `คุณเคยส่งรายงานของวันที่ ${formatDate(reportDate)} ไปแล้วในใบงานนี้ หากต้องการแก้ไขกรุณากดปุ่มแก้ไขข้อมูล`,
      );
      return;
    }
    // Editing today's own already-saved report (e.g. just adding/removing a
    // worker) already satisfied the "must exceed prior day" rule once, at
    // creation — re-checking it against progressBounds.min on every edit
    // blocks a same-value resave whenever today's progress happens to equal
    // the prior day's (feedback 2026-08-04). Only a brand-new day's entry
    // needs to clear progressBounds.min; an edit just can't go backward.
    const allowedMinVal = isEditingExisting && existingHistory
      ? (existingHistory.progress > 0 ? existingHistory.progress - 1 : -1)
      : (progressBounds.min > 0 ? progressBounds.min : -1);
    if (progress <= allowedMinVal) {
      await showAlert(
        isEditingExisting && existingHistory
          ? `ความคืบหน้าต้องไม่น้อยกว่าค่าที่บันทึกไว้เดิม (${existingHistory.progress}%)`
          : `ความคืบหน้าสำหรับวันที่เลือกต้องมากกว่า ${progressBounds.min}% (ตามประวัติก่อนหน้า)`,
      );
      return;
    }
    if (progress > progressBounds.max) {
      await showAlert(
        `ความคืบหน้าสำหรับวันที่เลือกต้องไม่เกิน ${progressBounds.max}% (เนื่องจากมีข้อมูลวันที่หลังจากนี้ลงไปแล้ว)`,
      );
      return;
    }

    // Same shift flag alone doesn't mean the actual clock hours overlap
    // (e.g. "normal" 08:00-12:00 on task A vs "normal" 13:00-17:00 on task B) —
    // compare the real shiftTimes ranges via isTimeOverlap. Shared by both the
    // same-task and cross-task duplicate checks below.
    const DEFAULT_SHIFT_TIME: Record<string, string> = {
      normal: "08:00 - 17:00",
      otMorning: "06:00 - 08:00",
      otNoon: "12:00 - 13:00",
      otEvening: "18:00 - 21:00",
    };
    const SHIFT_TIME_KEY: Record<string, keyof NonNullable<LaborEntry["shiftTimes"]>> = {
      normal: "day",
      otMorning: "otMorning",
      otNoon: "otNoon",
      otEvening: "otEvening",
    };
    const SHIFT_LABEL: Record<string, string> = {
      normal: "กะปกติ",
      otMorning: "OT เช้า",
      otNoon: "OT เที่ยง",
      otEvening: "OT เย็น",
    };
    const getShiftTime = (entry: any, shiftKey: string) =>
      entry.shiftTimes?.[SHIFT_TIME_KEY[shiftKey]] || DEFAULT_SHIFT_TIME[shiftKey];
    const overlappingShiftsOf = (a: any, b: any): string[] => {
      const result: string[] = [];
      (["normal", "otMorning", "otNoon", "otEvening"] as const).forEach((shiftKey) => {
        if (
          a.shifts?.[shiftKey] &&
          b.shifts?.[shiftKey] &&
          isTimeOverlap(getShiftTime(a, shiftKey), getShiftTime(b, shiftKey))
        ) {
          result.push(SHIFT_LABEL[shiftKey]);
        }
      });
      return result;
    };

    // 🚨 Same-task duplicate validation: defense-in-depth against duplicate labor
    // entries for the SAME worker ending up in this report's own labor list — no
    // matter which code path put them there (batch-add double click, draft restore,
    // manual add, etc.) — before it ever reaches the cross-task check below (which
    // deliberately skips the current task).
    const sameTaskDuplicates: string[] = [];
    labor.forEach((l, i) => {
      const idToCheck = l.staffId || l.contractorId;
      if (!idToCheck) return;
      labor.forEach((other, j) => {
        if (j <= i) return;
        const otherId = other.staffId || other.contractorId;
        if (otherId !== idToCheck) return;

        const overlappingShifts = overlappingShiftsOf(l, other);
        if (overlappingShifts.length > 0) {
          const workerName = l.staffName || (l as any).name || l.affiliation || idToCheck;
          sameTaskDuplicates.push(`${workerName} (${overlappingShifts.join(", ")})`);
        }
      });
    });

    if (sameTaskDuplicates.length > 0) {
      await showAlert(`พบรายการแรงงานซ้ำซ้อนในรายงานนี้ กรุณาลบรายการที่ซ้ำก่อนบันทึก:\n- ${sameTaskDuplicates.join('\n- ')}`);
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
                const overlappingShifts = overlappingShiftsOf(l, matchingWorker);

                if (overlappingShifts.length > 0) {
                  const workerName = l.staffName || (l as any).name || l.affiliation || idToCheck;
                  const taskNameClean = (t.name || t.taskName || t.id).replace(/\s*\(REV\.\s*\d+\)/gi, '').trim();

                  duplicateWorkers.push(`${workerName} ในงาน "${taskNameClean}" (${overlappingShifts.join(", ")})`);
                }
              }
            }
          });
        });
      });
    });

    if (duplicateWorkers.length > 0) {
      await showAlert(`ไม่สามารถบันทึกรายงานได้ เนื่องจากมีคนงานปฏิบัติงานซ้ำซ้อนในวันและกะเวลาเดียวกัน:\n- ${duplicateWorkers.join('\n- ')}`);
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
      const foremanEmpId = user?.employeeId || user?.id || "101527";
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
      const isWoaWop = isWoaWopType(selectedTaskInfo.wo);
      const updateId = isWoaWop
        ? reportDate
        : isEditingExisting && existingHistory
          ? existingHistory.id
          : `h-${Date.now()}`;
      const newUpdate = {
        id: updateId,
        // reportDate is a Thai-calendar date string; pairing it with a raw UTC
        // clock time (old code) mislabels the timestamp whenever submitted
        // 00:00-06:59 Thai time (still "yesterday evening" in UTC), shifting
        // it a full day off for anything that reads this via new Date(...).getTime()
        // (Dashboard.tsx, ForemanCalendar.tsx, History.tsx). Use the same
        // Thai-shifted-clock convention as lib/dateUtils.ts's todayTH() instead,
        // so both halves of the string agree on the same timezone.
        date: `${reportDate}T${new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split("T")[1]}`,
        note,
        progress,
        photos: photosPayload,
        labor: laborPayload,
        leave: leavePayload,
        type: reportType,
        status: "submitted",
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
          const _isWoa = isWoaWopType(selectedTaskInfo.wo);
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
      await claimLaborDayLocks(
        labor,
        reportDate,
        selectedTaskInfo.wo.id,
        selectedTaskInfo.task.id,
        (selectedTaskInfo.task.name || selectedTaskInfo.task.taskName || selectedTaskInfo.task.id).replace(/\s*\(REV\.\s*\d+\)/gi, '').trim(),
        existingHistory?.labor || [],
      );

      await addTaskUpdate(
        selectedTaskInfo.wo.id,
        selectedTaskInfo.categoryId,
        selectedTaskInfo.task.id,
        newUpdate as any,
      );

      // ลบแบบร่าง (Draft) ออกจากระบบเมื่อทำการส่งรายงานผลสำเร็จ
      try {
        const isWoaWop = isWoaWopType(selectedTaskInfo.wo);
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

      await showAlert("บันทึกรายงานเรียบร้อยแล้ว");
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
        setReportDate(todayTH());
      }
    } catch (error: any) {
      console.error("Submit failed:", error);
      if (error?.code === 'LABOR_DAY_LOCK_CONFLICT') {
        await showAlert(error.message);
      } else if (error?.message === 'DUPLICATE_PENDING') {
        await showAlert("มีคำขอรับรองสำหรับวันนี้รออยู่แล้ว กรุณารอการรับรองก่อน");
        setRetroactiveSubmitDone(true);
        setShowSummaryModal(false);
      } else {
        await showAlert("บันทึกรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // T-craft (2026-07-24): a draft now writes REAL progress into the same
  // dailyReports entry a final submit would (status: 'draft' vs 'submitted') —
  // matching the Labor system's reference model — instead of a separate shadow
  // doc nobody but the foreman's own browser ever saw. Requirements mirror
  // Labor's: site photos are mandatory for a draft too (progress must be real),
  // labor photos are NOT (those are only enforced by handleSubmit/handleFinalSubmit's
  // full validation). A locked (>3 day) date still requires admin approval either
  // way — this routes through the exact same submitRetroactiveRequest path
  // handleFinalSubmit uses (user-confirmed 2026-07-24).
  const handleSaveDraft = async () => {
    if (submittingRef.current || isSubmitting) return;
    if (!selectedTaskInfo) return;

    if (sitePhotos.filter(Boolean).length < 2) {
      await showAlert("กรุณาแนบรูปถ่ายหน้างานอย่างน้อย 2 รูป");
      return;
    }
    // Draft skips the lower (monotonic) bound — an in-progress save may sit
    // below the last committed value while the foreman works through the day
    // (matches Labor's reference implementation). Upper bound still applies.
    if (progress > progressBounds.max) {
      await showAlert(
        `ความคืบหน้าสำหรับวันที่เลือกต้องไม่เกิน ${progressBounds.max}% (เนื่องจากมีข้อมูลวันที่หลังจากนี้ลงไปแล้ว)`,
      );
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const foremanEmpId = user?.employeeId || user?.id || "101527";
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
          amount: l.amount || 1,
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
              ? { in: laborOtMorningPhotos[0] || "", out: laborOtMorningPhotos[1] || "" }
              : null,
          otNoon:
            laborOtNoonPhotos[0] || laborOtNoonPhotos[1]
              ? { in: laborOtNoonPhotos[0] || "", out: laborOtNoonPhotos[1] || "" }
              : null,
          otEvening:
            laborOtEveningPhotos[0] || laborOtEveningPhotos[1]
              ? { in: laborOtEveningPhotos[0] || "", out: laborOtEveningPhotos[1] || "" }
              : null,
        },
      };
      const isWoaWop = isWoaWopType(selectedTaskInfo.wo);
      const updateId = isWoaWop ? reportDate : `h-${Date.now()}`;
      const draftUpdate = {
        id: updateId,
        date: `${reportDate}T${new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split("T")[1]}`,
        note,
        progress,
        photos: photosPayload,
        labor: laborPayload,
        leave: [] as any[],
        type: reportType,
        status: "draft",
        projectLocationId: selectedTaskInfo.wo.projectId || "",
        createdBy: foremanEmpId,
        createdAt: new Date().toISOString(),
        updatedBy: foremanEmpId,
        updatedAt: new Date().toISOString(),
      };

      if (isReportDatePast3Days) {
        // Same "needs admin approval" gate handleFinalSubmit uses — a locked date
        // can't be draft-saved directly either (user-confirmed 2026-07-24).
        await submitRetroactiveRequest(
          selectedTaskInfo.wo.id,
          selectedTaskInfo.categoryId,
          selectedTaskInfo.task.id,
          reportDate,
          {
            progress,
            note,
            type: reportType as string,
            labor: laborPayload,
            leave: [],
            photos: photosPayload,
          },
          { uid: user?.id || foremanEmpId, name: (user as any)?.name || (user as any)?.displayName || "โฟรแมน" },
        );
        setRetroactiveSubmitDone(true);
        await showAlert("เกินกำหนด 3 วัน — ส่งคำขอรับรองข้อมูลย้อนหลังให้ Admin แล้ว");
        return;
      }

      const draftHistory = selectedTaskInfo.task.history || [];
      const draftFilteredHistory = filterHistoryByRevision(draftHistory, selectedTaskInfo.task.revisionCreatedAt, selectedTaskInfo.task.currentRevision);
      const draftExistingHistory = draftFilteredHistory.find(
        (h) => {
          const matchesHelper = selectedTaskInfo.task.isHelper ? h.isSupportReport === true : h.isSupportReport !== true;
          return h.date?.split("T")[0] === reportDate && matchesHelper;
        }
      );
      await claimLaborDayLocks(
        labor,
        reportDate,
        selectedTaskInfo.wo.id,
        selectedTaskInfo.task.id,
        (selectedTaskInfo.task.name || selectedTaskInfo.task.taskName || selectedTaskInfo.task.id).replace(/\s*\(REV\.\s*\d+\)/gi, '').trim(),
        draftExistingHistory?.labor || [],
      );

      await addTaskUpdate(
        selectedTaskInfo.wo.id,
        selectedTaskInfo.categoryId,
        selectedTaskInfo.task.id,
        draftUpdate as any,
      );

      setDraftedTaskIds(prev => {
        const next = new Set(prev).add(selectedTaskInfo.task.id);
        sessionStorage.setItem('draftedTaskIds', JSON.stringify([...next]));
        return next;
      });
      await showAlert("บันทึกแบบร่างเรียบร้อยแล้ว");
    } catch (error: any) {
      console.error("Save draft failed:", error);
      if (error?.code === 'LABOR_DAY_LOCK_CONFLICT') {
        await showAlert(error.message);
      } else if (error?.message === 'DUPLICATE_PENDING') {
        await showAlert("มีคำขอรับรองสำหรับวันนี้รออยู่แล้ว กรุณารอการรับรองก่อน");
        setRetroactiveSubmitDone(true);
      } else {
        await showAlert("บันทึกแบบร่างไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      submittingRef.current = false;
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


  const updatePhCategoryProgress = async (woId: string, catId: string, progress: number): Promise<void> => {
    await updateDoc(doc(db, 'workOrders', woId, 'categories', catId), {
      dailyProgress: progress,
      lastProgressUpdate: new Date().toISOString(),
    });
  };

  // ─── PreHandover Detail Pane state ───
  const [selectedPhCatInfo, setSelectedPhCatInfo] = useState<{ wo: any; cat: any } | null>(null);
  const [phDailyHistory, setPhDailyHistory] = useState<any[]>([]);
  const [phDraftedDates, setPhDraftedDates] = useState<Set<string>>(new Set());
  const [isPhEditingExisting, setIsPhEditingExisting] = useState(false);
  const [showPhSummaryModal, setShowPhSummaryModal] = useState(false);

  // Reset form + load history when category changes
  useEffect(() => {
    if (!selectedPhCatInfo) return;
    setSelectedTaskInfo(null);
    setProgress(selectedPhCatInfo.cat.dailyProgress || 0);
    setNote('');
    setLabor([]);
    setSitePhotos([]);
    setLaborRegularPhotos([]);
    setLaborOtMorningPhotos([]);
    setLaborOtNoonPhotos([]);
    setLaborOtEveningPhotos([]);
    setReportDate(todayTH());
    const { wo, cat } = selectedPhCatInfo;
    const phRev = cat.currentRevision || 'rev00';
    const phTaskId = cat.id;
    const phSubtaskId = cat.id.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
    // Primary: new WOA-matching path tasks/{id}/subtasks/{id}/revisions/{rev}/dailyReports
    getDocs(collection(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', phTaskId, 'subtasks', phSubtaskId, 'revisions', phRev, 'dailyReports')).then(async snap => {
      if (snap.size > 0) {
        const hist = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
        setPhDailyHistory(hist);
      } else {
        // Fallback 1: old revisions/{rev}/dailyReports (before task layer)
        const oldSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', cat.id, 'revisions', phRev, 'dailyReports'));
        if (oldSnap.size > 0) {
          const hist = oldSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
          setPhDailyHistory(hist);
        } else {
          // Fallback 2: intermediate phRevisions/rev00/phDailyReports (before collection rename)
          const midSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', cat.id, 'phRevisions', phRev, 'phDailyReports'));
          if (midSnap.size > 0) {
            const hist = midSnap.docs.map(d => ({ id: d.id, ...d.data() }))
              .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
            setPhDailyHistory(hist);
          } else if (!cat.currentRevision) {
            // Fallback 3: original flat path phDailyReports
            const flatSnap = await getDocs(collection(db, 'workOrders', wo.id, 'categories', cat.id, 'phDailyReports'));
            const hist = flatSnap.docs.map(d => ({ id: d.id, ...d.data() }))
              .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
            setPhDailyHistory(hist);
          } else {
            setPhDailyHistory([]);
          }
        }
      }
    });
  }, [selectedPhCatInfo?.wo.id, selectedPhCatInfo?.cat.id, selectedPhCatInfo?.cat.currentRevision]);

  // Load existing report for selected date (PreHandover)
  useEffect(() => {
    if (!selectedPhCatInfo) return;
    setPhRetroactiveSubmitDone(false);
    setIsPhEditingExisting(false);
    const { wo, cat } = selectedPhCatInfo;
    const phRev = cat.currentRevision || 'rev00';
    const phTaskId = cat.id;
    const phSubtaskId = cat.id.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
    // Primary: new WOA-matching path
    getDoc(doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', phTaskId, 'subtasks', phSubtaskId, 'revisions', phRev, 'dailyReports', reportDate)).then(async snap => {
      // Collect all candidate docs from every legacy path, pick the richest one
      const [oldSnap, midSnap2, flatSnap2] = await Promise.all([
        snap.exists() ? Promise.resolve(null) : getDoc(doc(db, 'workOrders', wo.id, 'categories', cat.id, 'revisions', phRev, 'dailyReports', reportDate)),
        snap.exists() ? Promise.resolve(null) : getDoc(doc(db, 'workOrders', wo.id, 'categories', cat.id, 'phRevisions', phRev, 'phDailyReports', reportDate)),
        snap.exists() ? Promise.resolve(null) : getDoc(doc(db, 'workOrders', wo.id, 'categories', cat.id, 'phDailyReports', reportDate)),
      ]);
      const candidates = [snap, oldSnap, midSnap2, flatSnap2].filter(s => s?.exists());
      // Prefer doc with labor data, then highest progress
      const resolvedSnap = candidates.sort((a, b) => {
        const aData = a!.data() as any;
        const bData = b!.data() as any;
        const aHasLabor = (aData.labor?.length || 0) > 0 ? 1 : 0;
        const bHasLabor = (bData.labor?.length || 0) > 0 ? 1 : 0;
        if (bHasLabor !== aHasLabor) return bHasLabor - aHasLabor;
        return (bData.progress || 0) - (aData.progress || 0);
      })[0] || null;
      if (resolvedSnap?.exists()) {
        // Existing report — a submitted one keeps editing locked (false); a draft
        // (status: 'draft', not finalized yet) resumes straight into edit mode,
        // same as the old shadow-draft flow below did.
        const d = resolvedSnap.data();
        setProgress(d.progress ?? selectedPhCatInfo.cat.dailyProgress ?? 0);
        setNote(d.note || '');
        setLabor(ensureLaborIds(d.labor || []));
        // Support both new format (photos.site/laborByShift) and legacy (sitePhotos/laborPhotos)
        setSitePhotos(d.photos?.site || d.sitePhotos || []);
        setLaborRegularPhotos(d.photos?.laborByShift?.regular || d.laborPhotos?.regular || []);
        setLaborOtMorningPhotos(d.photos?.laborByShift?.otMorning || d.laborPhotos?.otMorning || []);
        setLaborOtNoonPhotos(d.photos?.laborByShift?.otNoon || d.laborPhotos?.otNoon || []);
        setLaborOtEveningPhotos(d.photos?.laborByShift?.otEvening || d.laborPhotos?.otEvening || []);
        if ((d as any).status === 'draft') {
          setPhDraftedDates(prev => new Set([...prev, reportDate]));
        }
        setIsPhEditingExisting((d as any).status === 'draft');
      } else {
        // No main report — check for draft
        getDoc(doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', phTaskId, 'subtasks', phSubtaskId, 'revisions', phRev, 'dailyReportsDraft', reportDate)).then(draftSnap => {
          if (draftSnap.exists()) {
            const d = draftSnap.data();
            setProgress(d.progress ?? selectedPhCatInfo.cat.dailyProgress ?? 0);
            setNote(d.note || '');
            setLabor(ensureLaborIds(d.labor || []));
            setSitePhotos(d.photos?.site || d.sitePhotos || []);
            setLaborRegularPhotos(d.photos?.laborByShift?.regular || d.laborPhotos?.regular || []);
            setLaborOtMorningPhotos(d.photos?.laborByShift?.otMorning || d.laborPhotos?.otMorning || []);
            setLaborOtNoonPhotos(d.photos?.laborByShift?.otNoon || d.laborPhotos?.otNoon || []);
            setLaborOtEveningPhotos(d.photos?.laborByShift?.otEvening || d.laborPhotos?.otEvening || []);
            setPhDraftedDates(prev => new Set([...prev, reportDate]));
            setIsPhEditingExisting(true); // draft = new report in progress
          } else {
            setProgress(selectedPhCatInfo.cat.dailyProgress || 0);
            setNote('');
            setLabor([]);
            setSitePhotos([]);
            setLaborRegularPhotos([]);
            setLaborOtMorningPhotos([]);
            setLaborOtNoonPhotos([]);
            setLaborOtEveningPhotos([]);
            setPhDraftedDates(prev => { const n = new Set(prev); n.delete(reportDate); return n; });
            setIsPhEditingExisting(true); // brand new — fully editable
          }
        });
      }
    });
  }, [reportDate, selectedPhCatInfo?.wo.id, selectedPhCatInfo?.cat.id]);

  const [phRetroactiveSubmitDone, setPhRetroactiveSubmitDone] = useState(false);

  const getPhDateStatus = (dateStr: string): "disabled" | "reported" | "unlocked" | "locked" => {
    const todayStr = todayTH();
    if (dateStr > todayStr) return 'disabled';
    // No floor at wo.scheduledDate (user 2026-07-24, matches the WOA fix in
    // getDateStatus above): work can predate when the WO was scheduled/opened.
    if (phDailyHistory.some((h: any) => h.date === dateStr)) return 'reported';
    const diffDays = Math.ceil((new Date(todayStr).getTime() - new Date(dateStr).getTime()) / 86400000);
    if (diffDays <= 3) return 'unlocked';
    const cat = selectedPhCatInfo?.cat;
    if (cat?.phUnlockedDates?.[dateStr]?.unlockedUntil > new Date().toISOString()) return 'unlocked';
    return 'locked';
  };

  const isPhReportDatePast3Days = useMemo(() => {
    if (!selectedPhCatInfo || !reportDate) return false;
    const todayStr = todayTH();
    const diffDays = Math.ceil((new Date(todayStr).getTime() - new Date(reportDate).getTime()) / 86400000);
    if (diffDays <= 3) return false;
    const cat = selectedPhCatInfo.cat;
    return !(cat?.phUnlockedDates?.[reportDate]?.unlockedUntil > new Date().toISOString());
  }, [selectedPhCatInfo, reportDate]);

  const isPhExistingReport = useMemo(() => {
    return phDailyHistory.some((h: any) => h.id === reportDate || h.date === reportDate);
  }, [phDailyHistory, reportDate]);

  const phProgressBounds = useMemo(() => {
    if (!selectedPhCatInfo) return { min: 0, max: 100, isToday: true };
    const targetDate = reportDate;
    let min = 0;
    let max = 100;
    phDailyHistory.forEach((h: any) => {
      const hDate = (h.date || h.id || '').split('T')[0];
      if (!hDate) return;
      if (hDate < targetDate) {
        if (h.progress > min) min = h.progress;
      } else if (hDate > targetDate) {
        const allowedMax = h.progress - 1;
        if (allowedMax < max) max = allowedMax;
      }
    });
    const isToday = targetDate === todayTH();
    // For today on a NEW report: min is at least the current category dailyProgress
    // Skip this floor when editing existing (the existing report IS today's progress)
    if (isToday && !isPhEditingExisting) {
      const catProgress = selectedPhCatInfo.cat.dailyProgress || 0;
      if (catProgress > min) min = catProgress;
    }
    // max is bounded ONLY by an actual future entry's progress (loop above) —
    // no blanket cap for backdated dates (user-confirmed correction 2026-07-23).
    return { min, max, isToday };
  }, [selectedPhCatInfo, phDailyHistory, reportDate]);

  // WOP unsaved changes — after isPhExistingReport + isPhEditingExisting to avoid TDZ
  const hasPhUnsavedChanges = useMemo(() => {
    if (!selectedPhCatInfo) return false;
    const isPhEditable = !isPhExistingReport || isPhEditingExisting;
    if (!isPhEditable) return false;
    const laborChanged    = labor.length > 0;
    const noteChanged     = note.trim() !== '';
    const photosChanged   = sitePhotos.length > 0 || laborRegularPhotos.length > 0 ||
      laborOtMorningPhotos.length > 0 || laborOtNoonPhotos.length > 0 || laborOtEveningPhotos.length > 0;
    const progressChanged = progress !== (selectedPhCatInfo.cat.dailyProgress || 0);
    return laborChanged || noteChanged || photosChanged || progressChanged;
  }, [
    selectedPhCatInfo, isPhExistingReport, isPhEditingExisting,
    labor, note, progress, sitePhotos,
    laborRegularPhotos, laborOtMorningPhotos, laborOtNoonPhotos, laborOtEveningPhotos,
  ]);

  // WOP beforeunload
  useEffect(() => {
    if (!hasPhUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "คุณมีข้อมูลรายงานความคืบหน้าที่ยังไม่ได้บันทึกค้างอยู่ หากออกจากหน้านี้ ข้อมูลที่กรอกไว้ทั้งหมดจะสูญหาย";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasPhUnsavedChanges]);

  // WOP Sidebar intercept — set window global when WOP form is dirty
  useEffect(() => {
    if (hasPhUnsavedChanges) (window as any).hasUnsavedChanges = true;
  }, [hasPhUnsavedChanges]);

  // Captures the current form state into the request doc (mirrors WOA's
  // submitRetroactiveRequest) so approvePhRetroactiveRequest can write the
  // real dailyReports doc straight from the approval — no foreman re-entry
  // "loop" after admin approval (user-flagged 2026-08-04 gap vs WOA).
  const submitPhRetroactiveRequest = async (): Promise<void> => {
    if (!selectedPhCatInfo) return;
    const { wo, cat } = selectedPhCatInfo;
    const foremanEmpId = user?.employeeId || user?.id || '';
    const reqRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'phRetroactiveRequests', reportDate);
    // Block duplicate pending — mirrors WOA's submitRetroactiveRequest DUPLICATE_PENDING
    // guard (WorkOrderContext.tsx). WOP's request doc ID is the date itself, so without
    // this check a second submit would silently setDoc-overwrite the still-pending
    // request's already-captured payload (user-flagged 2026-08-04).
    const existingSnap = await getDoc(reqRef);
    if (existingSnap.exists() && (existingSnap.data() as any).status === 'pending') {
      setPhRetroactiveSubmitDone(true);
      await showAlert("มีคำขอรับรองสำหรับวันนี้รออยู่แล้ว กรุณารอการรับรองก่อน");
      return;
    }
    const laborPayload = labor
      .filter(l => l.shifts?.normal || l.shifts?.otMorning || l.shifts?.otNoon || l.shifts?.otEvening)
      .map(l => ({
        membership: l.membership || 'Internal',
        workerId: l.staffId || l.contractorId || (l as any).id || '',
        workerName: l.staffName || l.affiliation || '',
        staffId: l.staffId || '',
        staffName: l.staffName || '',
        contractorId: l.contractorId || '',
        employeeId: l.employeeId || '',
        shiftTimes: {
          day: l.shifts?.normal ? l.shiftTimes?.day || '08:00 - 17:00' : null,
          otMorning: l.shifts?.otMorning ? l.shiftTimes?.otMorning || '06:00 - 08:00' : null,
          otNoon: l.shifts?.otNoon ? '12:00 - 13:00' : null,
          otEvening: l.shifts?.otEvening ? l.shiftTimes?.otEvening || '18:00 - 21:00' : null,
        },
        shifts: {
          normal: l.shifts?.normal || false,
          otMorning: l.shifts?.otMorning || false,
          otNoon: l.shifts?.otNoon || false,
          otEvening: l.shifts?.otEvening || false,
        },
        expectedShifts: {
          normal: l.shifts?.normal || false,
          otMorning: l.shifts?.otMorning || false,
          otNoon: l.shifts?.otNoon || false,
          otEvening: l.shifts?.otEvening || false,
        },
        expectedHours: {
          normal: l.shifts?.normal ? calculateWorkingHours(l.shiftTimes?.day || '08:00 - 17:00') : 0,
          otMorning: l.shifts?.otMorning ? 2 : 0,
          otNoon: l.shifts?.otNoon ? 1 : 0,
          otEvening: l.shifts?.otEvening ? 3 : 0,
        },
        amount: l.amount || 1,
        recordedBy: l.recordedBy || foremanEmpId,
      }));
    const photosPayload = {
      site: sitePhotos.filter(Boolean),
      laborByShift: {
        regular: laborRegularPhotos.filter(Boolean),
        otMorning: laborOtMorningPhotos.filter(Boolean),
        otNoon: laborOtNoonPhotos.filter(Boolean),
        otEvening: laborOtEveningPhotos.filter(Boolean),
      },
    };
    await setDoc(
      reqRef,
      {
        requestDate: reportDate,
        requestedBy: user?.name || 'ไม่ระบุ',
        requestedById: user?.id || user?.employeeId,
        requestedAt: new Date().toISOString(),
        status: 'pending',
        woId: wo.id,
        catId: cat.id,
        catName: cat.name,
        payload: {
          progress,
          note,
          type: 'Normal',
          labor: laborPayload,
          photos: photosPayload,
        },
      }
    );
    // Notify Admin — mirrors WOA's caller-side sendNotification after submitRetroactiveRequest
    // (this was previously missing for WOP; Admin only found out by opening /evaluation).
    try {
      await sendNotification({
        recipientRole: 'Admin',
        senderId: user?.id || foremanEmpId,
        senderName: (user as any)?.name || (user as any)?.displayName || 'โฟรแมน',
        title: 'คำขอรับรองข้อมูลย้อนหลัง (ก่อนโอน)',
        message: `${(user as any)?.name || 'โฟรแมน'} ขอรับรองข้อมูลวันที่ ${reportDate} หมวด "${cat.name}" (${wo.id}) — กรุณาตรวจสอบ`,
        type: 'warning',
        targetPath: '/evaluation',
      });
    } catch (_) {}
    setPhRetroactiveSubmitDone(true);
  };

  const submitPhDailyReport = async (noteType?: string): Promise<void> => {
    if (submittingRef.current || isSubmitting) return;
    if (!selectedPhCatInfo) return;
    // Same mandatory-evidence checks as AfterSale's handleSubmit — WOA and WOP
    // must enforce identical requirements (user-confirmed 2026-07-23).
    if (labor.length === 0) {
      await showAlert("กรุณาระบุข้อมูลแรงงานที่เข้าดำเนินการ");
      return;
    }
    if (sitePhotos.filter(Boolean).length < 2) {
      await showAlert("กรุณาแนบรูปถ่ายหน้างานอย่างน้อย 2 รูป");
      return;
    }
    const isRegularActive = labor.some((l) => l.shifts?.normal);
    if (isRegularActive) {
      const requiredCount = getRequiredRegularPhotoCount(labor);
      const uploadedCount = laborRegularPhotos.filter(Boolean).length;
      if (uploadedCount < requiredCount) {
        if (requiredCount === 2) {
          await showAlert("กรุณาแนบรูปถ่ายแรงงานกะปกติให้ครบ 2 รูป (เข้า / ออก)");
          return;
        } else {
          await showAlert(
            "กรุณาแนบรูปถ่ายแรงงานกะปกติให้ครบ 4 รูป (เข้า / พักเที่ยง / เข้าบ่าย / ออก)",
          );
          return;
        }
      }
    }
    const isOtMorningActive = labor.some((l) => l.shifts?.otMorning);
    if (isOtMorningActive && laborOtMorningPhotos.filter(Boolean).length < 2) {
      await showAlert("กรุณาแนบรูปถ่ายแรงงาน OT เช้าให้ครบ 2 รูป (เข้า / ออก)");
      return;
    }
    const isOtNoonActive = labor.some((l) => l.shifts?.otNoon);
    if (isOtNoonActive && laborOtNoonPhotos.filter(Boolean).length < 2) {
      await showAlert("กรุณาแนบรูปถ่ายแรงงาน OT เที่ยงให้ครบ 2 รูป (เข้า / ออก)");
      return;
    }
    const isOtEveningActive = labor.some((l) => l.shifts?.otEvening);
    if (isOtEveningActive && laborOtEveningPhotos.filter(Boolean).length < 2) {
      await showAlert("กรุณาแนบรูปถ่ายแรงงาน OT เย็นให้ครบ 2 รูป (เข้า / ออก)");
      return;
    }
    const existingHistReport = phDailyHistory.find((h: any) => h.id === reportDate || h.date === reportDate);
    if (existingHistReport && !isPhEditingExisting) {
      await showAlert(`คุณเคยส่งรายงานของวันที่ ${reportDate} ในหมวดงานนี้แล้ว หากต้องการแก้ไขกรุณากดปุ่ม "แก้ไขข้อมูล"`);
      return;
    }
    // Progress bounds validation (same as AfterSale). Editing today's own
    // already-saved report shouldn't have to clear progressBounds.min again —
    // that was already satisfied when it was first created; an edit just
    // can't go backward below its own saved value (feedback 2026-08-04).
    const allowedMinVal = isPhEditingExisting && existingHistReport
      ? (existingHistReport.progress > 0 ? existingHistReport.progress - 1 : -1)
      : (phProgressBounds.min > 0 ? phProgressBounds.min : -1);
    if (progress <= allowedMinVal) {
      await showAlert(
        isPhEditingExisting && existingHistReport
          ? `ความคืบหน้าต้องไม่น้อยกว่าค่าที่บันทึกไว้เดิม (${existingHistReport.progress}%)`
          : `ความคืบหน้าสำหรับวันที่เลือกต้องมากกว่า ${phProgressBounds.min}% (ตามประวัติก่อนหน้า)`,
      );
      return;
    }
    if (progress > phProgressBounds.max) {
      await showAlert(`ความคืบหน้าสำหรับวันที่เลือกต้องไม่เกิน ${phProgressBounds.max}% (เนื่องจากมีข้อมูลวันที่หลังจากนี้ลงไปแล้ว)`);
      return;
    }
    // Same "needs admin approval" gate savePhDraft uses — a locked (>3 day) date
    // can't be final-submitted directly either, even if a draft already exists
    // for it (matches WOA's handleSubmit gate — user-confirmed 2026-08-04: an
    // existing draft must not bypass the retroactive-approval requirement).
    if (isPhReportDatePast3Days) {
      await submitPhRetroactiveRequest();
      await showAlert("เกินกำหนด 3 วัน — ส่งคำขอรับรองข้อมูลย้อนหลังให้ Admin แล้ว");
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const { wo, cat } = selectedPhCatInfo;
      const phRev = cat.currentRevision || 'rev00';
      const foremanEmpId = user?.employeeId || user?.id || '';
      const laborPayload = labor
        .filter(l => l.shifts?.normal || l.shifts?.otMorning || l.shifts?.otNoon || l.shifts?.otEvening)
        .map(l => ({
          membership: l.membership || 'Internal',
          workerId: l.staffId || l.contractorId || (l as any).id || '',
          workerName: l.staffName || l.affiliation || '',
          staffId: l.staffId || '',
          staffName: l.staffName || '',
          contractorId: l.contractorId || '',
          employeeId: l.employeeId || '',
          shiftTimes: {
            day: l.shifts?.normal ? l.shiftTimes?.day || '08:00 - 17:00' : null,
            otMorning: l.shifts?.otMorning ? l.shiftTimes?.otMorning || '06:00 - 08:00' : null,
            otNoon: l.shifts?.otNoon ? '12:00 - 13:00' : null,
            otEvening: l.shifts?.otEvening ? l.shiftTimes?.otEvening || '18:00 - 21:00' : null,
          },
          shifts: {
            normal: l.shifts?.normal || false,
            otMorning: l.shifts?.otMorning || false,
            otNoon: l.shifts?.otNoon || false,
            otEvening: l.shifts?.otEvening || false,
          },
          expectedShifts: {
            normal: l.shifts?.normal || false,
            otMorning: l.shifts?.otMorning || false,
            otNoon: l.shifts?.otNoon || false,
            otEvening: l.shifts?.otEvening || false,
          },
          expectedHours: {
            normal: l.shifts?.normal ? calculateWorkingHours(l.shiftTimes?.day || '08:00 - 17:00') : 0,
            otMorning: l.shifts?.otMorning ? 2 : 0,
            otNoon: l.shifts?.otNoon ? 1 : 0,
            otEvening: l.shifts?.otEvening ? 3 : 0,
          },
          amount: l.amount || 1,
          recordedBy: l.recordedBy || foremanEmpId,
        }));
      const phTaskId = cat.id;
      const phSubtaskId = cat.id.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
      const payload = {
        id: reportDate,
        date: reportDate,
        progress,
        note,
        type: noteType || 'Normal',
        labor: laborPayload,
        photos: {
          site: sitePhotos.filter(Boolean),
          laborByShift: {
            regular: laborRegularPhotos.filter(Boolean),
            otMorning: laborOtMorningPhotos.filter(Boolean),
            otNoon: laborOtNoonPhotos.filter(Boolean),
            otEvening: laborOtEveningPhotos.filter(Boolean),
          },
        },
        createdBy: foremanEmpId,
        createdAt: new Date().toISOString(),
        updatedBy: foremanEmpId,
        updatedAt: new Date().toISOString(),
        revisionId: phRev,
        revisionName: phRev === 'rev00' ? 'Initial Revision' : `Revision ${phRev}`,
        status: 'submitted',
        projectId: wo.projectId || '',
      };
      const taskRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', phTaskId);
      const subtaskRef = doc(taskRef, 'subtasks', phSubtaskId);
      const progressUpdate = { dailyProgress: progress, progressStatus: 'submitted', lastProgressUpdate: new Date().toISOString() };
      await claimLaborDayLocks(
        labor,
        reportDate,
        wo.id,
        phTaskId,
        (cat.name || (cat as any).categoryName || phTaskId),
        existingHistReport?.labor || [],
      );
      await setDoc(doc(subtaskRef, 'revisions', phRev, 'dailyReports', reportDate), payload);
      await Promise.all([
        updateDoc(subtaskRef, progressUpdate),
        updateDoc(taskRef, progressUpdate),
      ]);
      // Trigger daily report sync API (mirrors WOA flow in WorkOrderContext.addTaskUpdate) —
      // without this, PreHandover (WOP) daily reports never produce a DailyEmployeeTimesheets record.
      try {
        const phReportPath = `workOrders/${wo.id}/categories/${cat.id}/tasks/${phTaskId}/subtasks/${phSubtaskId}/revisions/${phRev}/dailyReports/${reportDate}`;
        console.log('Syncing WOP daily report to LB API...', { reportPath: phReportPath, reportDate });
        const syncResponse = await fetch('https://asia-southeast1-after-sale-system.cloudfunctions.net/syncDailyReport', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportPath: phReportPath, reportDate }),
        });
        if (!syncResponse.ok) {
          console.error('Failed to sync WOP daily report:', syncResponse.status, await syncResponse.text());
        } else {
          console.log('Successfully synced WOP daily report to LB API');
        }
      } catch (syncError) {
        console.error('Error calling syncDailyReport API for WOP:', syncError);
      }
      // Delete draft if exists
      try {
        await deleteDoc(doc(subtaskRef, 'revisions', phRev, 'dailyReportsDraft', reportDate));
        setPhDraftedDates(prev => { const n = new Set(prev); n.delete(reportDate); return n; });
      } catch (_) {}
      const snap = await getDocs(collection(subtaskRef, 'revisions', phRev, 'dailyReports'));
      const hist = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
      setPhDailyHistory(hist);
      // ── Post-submit success (mirrors WOA flow) ──
      setShowPhSummaryModal(false);
      await showAlert('บันทึกรายงานเรียบร้อยแล้ว');
      if (!isPhEditingExisting) {
        // New report: full reset + close pane (same as WOA setSelectedTaskInfo(null))
        setSelectedPhCatInfo(null);
        setProgress(0);
        setNote('');
        setLabor([]);
        setSitePhotos([]);
        setLaborRegularPhotos([]);
        setLaborOtMorningPhotos([]);
        setLaborOtNoonPhotos([]);
        setLaborOtEveningPhotos([]);
        setReportDate(todayTH());
      } else {
        // Editing: just exit edit mode
        setIsPhEditingExisting(false);
      }
    } catch (err: any) {
      setShowPhSummaryModal(false);
      if (err?.code === 'LABOR_DAY_LOCK_CONFLICT') {
        await showAlert(err.message);
      } else {
        await showAlert('บันทึกรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
      console.error('submitPhDailyReport failed:', err);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // T-craft (2026-07-24): mirrors WOA's handleSaveDraft — writes REAL progress
  // into the same dailyReports entry a final submit would (status: 'draft' vs
  // 'submitted'), instead of a separate shadow doc. Site photos are mandatory
  // (progress must be real); labor photos are not (only submitPhDailyReport's
  // full validation requires those). A locked (>3 day) date routes through the
  // same submitPhRetroactiveRequest path the final-submit button uses.
  const savePhDraft = async (): Promise<void> => {
    if (!selectedPhCatInfo || isSubmitting) return;

    if (sitePhotos.filter(Boolean).length < 2) {
      await showAlert('กรุณาแนบรูปถ่ายหน้างานอย่างน้อย 2 รูป');
      return;
    }
    if (progress > phProgressBounds.max) {
      await showAlert(`ความคืบหน้าสำหรับวันที่เลือกต้องไม่เกิน ${phProgressBounds.max}% (เนื่องจากมีข้อมูลวันที่หลังจากนี้ลงไปแล้ว)`);
      return;
    }

    if (isPhReportDatePast3Days) {
      await submitPhRetroactiveRequest();
      await showAlert("เกินกำหนด 3 วัน — ส่งคำขอรับรองข้อมูลย้อนหลังให้ Admin แล้ว");
      return;
    }

    setIsSubmitting(true);
    try {
      const { wo, cat } = selectedPhCatInfo;
      const phRev = cat.currentRevision || 'rev00';
      const foremanEmpId = user?.employeeId || user?.id || '';
      const laborPayload = labor
        .filter(l => l.shifts?.normal || l.shifts?.otMorning || l.shifts?.otNoon || l.shifts?.otEvening)
        .map(l => ({
          membership: l.membership || 'Internal',
          workerId: l.staffId || l.contractorId || (l as any).id || '',
          workerName: l.staffName || l.affiliation || '',
          staffId: l.staffId || '',
          staffName: l.staffName || '',
          contractorId: l.contractorId || '',
          employeeId: l.employeeId || '',
          shiftTimes: {
            day: l.shifts?.normal ? l.shiftTimes?.day || '08:00 - 17:00' : null,
            otMorning: l.shifts?.otMorning ? l.shiftTimes?.otMorning || '06:00 - 08:00' : null,
            otNoon: l.shifts?.otNoon ? '12:00 - 13:00' : null,
            otEvening: l.shifts?.otEvening ? l.shiftTimes?.otEvening || '18:00 - 21:00' : null,
          },
          shifts: {
            normal: l.shifts?.normal || false,
            otMorning: l.shifts?.otMorning || false,
            otNoon: l.shifts?.otNoon || false,
            otEvening: l.shifts?.otEvening || false,
          },
          amount: l.amount || 1,
          recordedBy: l.recordedBy || foremanEmpId,
        }));
      const phTaskId = cat.id;
      const phSubtaskId = cat.id.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
      const payload = {
        id: reportDate,
        date: reportDate,
        progress,
        note,
        type: 'Normal',
        labor: laborPayload,
        photos: {
          site: sitePhotos.filter(Boolean),
          laborByShift: {
            regular: laborRegularPhotos.filter(Boolean),
            otMorning: laborOtMorningPhotos.filter(Boolean),
            otNoon: laborOtNoonPhotos.filter(Boolean),
            otEvening: laborOtEveningPhotos.filter(Boolean),
          },
        },
        createdBy: foremanEmpId,
        createdAt: new Date().toISOString(),
        updatedBy: foremanEmpId,
        updatedAt: new Date().toISOString(),
        revisionId: phRev,
        revisionName: phRev === 'rev00' ? 'Initial Revision' : `Revision ${phRev}`,
        status: 'draft',
        projectId: wo.projectId || '',
      };
      const taskRef = doc(db, 'workOrders', wo.id, 'categories', cat.id, 'tasks', phTaskId);
      const subtaskRef = doc(taskRef, 'subtasks', phSubtaskId);
      // Unlike a real submit, a draft never flips visible completion state — the
      // dailyProgress number is real, but progressStatus:'draft' keeps every
      // "is this actually done" gate (QR eligibility, pending-delivery buckets)
      // from firing off it (user-confirmed 2026-07-24).
      const progressUpdate = { dailyProgress: progress, progressStatus: 'draft', lastProgressUpdate: new Date().toISOString() };
      const draftExistingPhReport = phDailyHistory.find((h: any) => h.id === reportDate || h.date === reportDate);
      await claimLaborDayLocks(labor, reportDate, wo.id, phTaskId, (cat.name || (cat as any).categoryName || phTaskId), draftExistingPhReport?.labor || []);
      await setDoc(doc(subtaskRef, 'revisions', phRev, 'dailyReports', reportDate), payload);
      await Promise.all([
        updateDoc(subtaskRef, progressUpdate),
        updateDoc(taskRef, progressUpdate),
      ]);
      // Trigger daily report sync API (mirrors WOA flow in WorkOrderContext.addTaskUpdate) —
      // without this, PreHandover (WOP) daily reports never produce a DailyEmployeeTimesheets record.
      try {
        const phReportPath = `workOrders/${wo.id}/categories/${cat.id}/tasks/${phTaskId}/subtasks/${phSubtaskId}/revisions/${phRev}/dailyReports/${reportDate}`;
        console.log('Syncing WOP draft daily report to LB API...', { reportPath: phReportPath, reportDate });
        const syncResponse = await fetch('https://asia-southeast1-after-sale-system.cloudfunctions.net/syncDailyReport', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportPath: phReportPath, reportDate }),
        });
        if (!syncResponse.ok) {
          console.error('Failed to sync WOP draft daily report:', syncResponse.status, await syncResponse.text());
        } else {
          console.log('Successfully synced WOP draft daily report to LB API');
        }
      } catch (syncError) {
        console.error('Error calling syncDailyReport API for WOP draft:', syncError);
      }
      const snap = await getDocs(collection(subtaskRef, 'revisions', phRev, 'dailyReports'));
      const hist = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
      setPhDailyHistory(hist);
      setPhDraftedDates(prev => new Set([...prev, reportDate]));
      await showAlert('บันทึกแบบร่างเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('savePhDraft failed:', err);
      if (err?.code === 'LABOR_DAY_LOCK_CONFLICT') {
        await showAlert(err.message);
      } else {
        await showAlert('บันทึกแบบร่างไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableStaff = useMemo(() => dailyContractors
    .filter((c) => (c.department || "").toLowerCase().endsWith("wh"))
    .filter((c) => !labor.some((l) => l.staffId === c.id)), [dailyContractors, labor]);

  const availableContractors = useMemo(() => realContractors.filter(
    (c) => !labor.some((l) => l.contractorId === c.id),
  ), [realContractors, labor]);

  const selectPhCatInfo = (info: { wo: any; cat: any } | null) => {
    if (hasPhUnsavedChanges && info?.cat?.id !== selectedPhCatInfo?.cat?.id) {
      const ok = window.confirm(
        'คุณมีข้อมูลรายงานที่ยังไม่ได้บันทึกค้างอยู่ หากเปลี่ยนหมวดงาน ข้อมูลที่กรอกไว้ทั้งหมดจะสูญหาย\n\nต้องการเปลี่ยนหมวดงานหรือไม่?'
      );
      if (!ok) return;
    }
    setSelectedPhCatInfo(info);
  };

  const stable = useStableCallbacks({
    updatePhCategoryProgress,
    selectPhCatInfo,
    submitPhDailyReport,
    savePhDraft,
    getPhDateStatus,
    submitPhRetroactiveRequest,
    handleSelectTask,
    handleBatchAdd,
    handleTimeChange,
    handleRemoveSlotPhoto,
    handleSlotPhotoUpload,
    handleSitePhotosUpload,
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
    togglePhShift,
    getDateStatus,
    getTaskImage,
    openTimePicker,
    isTimeOverlap,
  });

  const value = useMemo(() => ({
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
        preHandoverWorkOrders,
        selectedPhCatInfo,
        setSelectedPhCatInfo,
        hasPhUnsavedChanges,
        showPhSummaryModal,
        setShowPhSummaryModal,
        phDailyHistory,
        phProgressBounds,
        phDraftedDates,
        isPhReportDatePast3Days,
        phRetroactiveSubmitDone,
        setPhRetroactiveSubmitDone,
        isPhEditingExisting,
        setIsPhEditingExisting,
        isPhExistingReport,

        addTaskUpdate,
        updateTask,
        updateWorkOrderStatus,
        requestRetroactiveUnlock,
        submitRetroactiveRequest,
        generateDeliveryQrToken,
        submitCustomerInspection,

        isProgressNotePhotosEditable,
        hasHistoryForSelectedDate,

        isReportDatePast3Days,
        progressBounds,
        draftedTaskIds,

        // Functions recreated every render are stabilized via useStableCallbacks
        // (see hooks/useStableCallbacks.ts) so this value object only changes
        // identity when something in the dependency list below actually changed —
        // without this, every consumer re-rendered on every provider render.
        ...stable,
  }), [
        workOrders, user, sendNotification, navigate, location, foremanId,
        highlightedId, setHighlightedId, selectedTaskInfo, setSelectedTaskInfo, isTaskFinished,
        searchTerm, setSearchTerm, progress, setProgress, note, setNote,
        labor, setLabor, sitePhotos, setSitePhotos, laborRegularPhotos, setLaborRegularPhotos,
        laborOtMorningPhotos, setLaborOtMorningPhotos, laborOtNoonPhotos, setLaborOtNoonPhotos,
        laborOtEveningPhotos, setLaborOtEveningPhotos, activePhotoTab, setActivePhotoTab,
        zoomImage, setZoomImage, isSidebarOpen, setIsSidebarOpen, showCalendarDropdown, setShowCalendarDropdown,
        showUnlockModal, setShowUnlockModal, pendingUnlockDate, setPendingUnlockDate,
        unlockReason, setUnlockReason, calendarYear, setCalendarYear, calendarMonth, setCalendarMonth,
        isEditingExisting, setIsEditingExisting, showSummaryModal, setShowSummaryModal,
        collapsedHelpers, setCollapsedHelpers, isUploading, setIsUploading,
        uploadingLeaveCertId, setUploadingLeaveCertId, isSubmitting, setIsSubmitting,
        submittingRef, retroactiveSubmitDone, setRetroactiveSubmitDone, activeModal, setActiveModal,
        timePickerTarget, setTimePickerTarget, reportType, setReportType, reportDate, setReportDate,
        realContractors, realProjects, dailyContractors,
        modalAlert, setModalAlert, isReviewModalOpen, setIsReviewModalOpen, reviewTaskInfo, setReviewTaskInfo,
        isCustomerMockupOpen, setIsCustomerMockupOpen, mockupWorkOrder, setMockupWorkOrder,
        availableStaff, availableContractors, newTasks, inProgressTasks, pendingInspectionTasks,
        pendingDeliveryWorkOrders, preHandoverWorkOrders, selectedPhCatInfo, setSelectedPhCatInfo,
        hasPhUnsavedChanges, showPhSummaryModal, setShowPhSummaryModal, phDailyHistory, phProgressBounds,
        phDraftedDates, isPhReportDatePast3Days, phRetroactiveSubmitDone, setPhRetroactiveSubmitDone,
        isPhEditingExisting, setIsPhEditingExisting, isPhExistingReport,
        addTaskUpdate, updateTask, updateWorkOrderStatus, requestRetroactiveUnlock, submitRetroactiveRequest,
        generateDeliveryQrToken, submitCustomerInspection,
        isProgressNotePhotosEditable, hasHistoryForSelectedDate, isReportDatePast3Days, progressBounds,
        draftedTaskIds, stable,
  ]);

  return (
    <DailyReportContext.Provider value={value}>
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
