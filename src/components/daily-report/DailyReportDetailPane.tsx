import React, { Fragment, useState } from "react";
import {
  HardHat,
  Camera,
  CheckCircle2,
  Users,
  Plus,
  Info,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Trash2,
  Paperclip,
  Eye,
  Lock,
  Calendar,
  Loader2,
  Activity,
  Edit2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Package,
  User,
} from "lucide-react";
import { useDailyReport, filterHistoryByRevision } from "../../context/DailyReportContext";
import { SLACountdown } from "./SLACountdowns";
import { computeJobSLA, SLA_HOURS_MAP } from "../../utils/jobSla";
import { ShiftConfig, ShiftTimes } from "../../types/dailyReport.types";
import { formatDate } from "../../utils/date";
import { todayTH } from "../../lib/dateUtils";
import { useIsMobile } from '../../hooks/useIsMobile';
import { gridCols } from '../ui/responsiveGrid';

const formatSubtaskId = (id: string | undefined): string => {
  if (!id) return "";
  const cleanId = id.replace(/^[A-Z]{2,4}-(?=[A-Z]{3}-)/i, '');
  const parts = cleanId.split('-');
  if (parts.length === 5) {
    return parts.slice(0, 4).join('-');
  }
  return cleanId;
};

export const DailyReportDetailPane: React.FC = () => {
  const {
    selectedTaskInfo,
    user,
    reportDate,
    progress,
    setProgress,
    note,
    setNote,
    labor,
    setLabor,
    sitePhotos,
    laborRegularPhotos,
    laborOtMorningPhotos,
    laborOtNoonPhotos,
    laborOtEveningPhotos,
    activePhotoTab,
    setActivePhotoTab,
    isSubmitting,
    isUploading,
    uploadingLeaveCertId,
    reportType,
    setReportType,
    handleRemoveSlotPhoto,
    handleSlotPhotoUpload,
    handleUploadLeaveCert,
    handleRemoveLeaveCert,
    handleSubmit,
    handleSaveDraft,
    toggleShift,
    isProgressNotePhotosEditable,
    hasHistoryForSelectedDate,
    getTaskImage,
    openTimePicker,
    
    isEditingExisting,
    isTaskFinished,
    calendarYear,
    setCalendarYear,
    calendarMonth,
    setCalendarMonth,
    setPendingUnlockDate,
    setUnlockReason,
    setShowUnlockModal,
    setShowCalendarDropdown,
    handleDateChange,
    handleBounceBackSLA,
    setSelectedTaskInfo,
    
    isReportDatePast3Days,
    retroactiveSubmitDone,
    setRetroactiveSubmitDone,
    isTimeOverlap,
    progressBounds,
    
    isSidebarOpen,
    setIsSidebarOpen,
    workOrders,
    realProjects,
    showCalendarDropdown,
    getDateStatus,
    handleCancelEdit,
    
    setZoomImage,
    setIsEditingExisting,
    setActiveModal,
  } = useDailyReport();

  const isMobile = useIsMobile();

  const [expandedPhotos, setExpandedPhotos] = useState<Set<string>>(new Set());
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [showSLAPopup, setShowSLAPopup] = useState(false);
  const [isCardCollapsed, setIsCardCollapsed] = useState(false);
  const [expandedLaborCards, setExpandedLaborCards] = useState<Set<string>>(new Set());
  const toggleLaborCard = (id: string) => setExpandedLaborCards(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const togglePhotos = (key: string) => setExpandedPhotos(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const isAwaitingAdmin = React.useMemo(() => {
    return selectedTaskInfo?.wo?.status === 'Rejected' && !selectedTaskInfo?.wo?.reviewedByAdmin;
  }, [selectedTaskInfo]);

  const canEditWorker = React.useCallback((l: any) => {
    if (user?.role === 'Admin') return true;
    if (!l.recordedBy) return true; // Legacy fallback
    const currentForemanId = user?.employeeId || user?.id || '';
    return l.recordedBy === currentForemanId;
  }, [user]);

  const displayLabor = labor;

  const displaySitePhotos = React.useMemo(() => {
    const ownPhotos = sitePhotos.filter(Boolean);
    if (ownPhotos.length > 0) return ownPhotos;

    if (selectedTaskInfo?.task?.isHelper) {
      // Main foreman's site photos (relaxed revisionId match to handle older data)
      const taskCurrentRev = selectedTaskInfo.task.currentRevision || 'rev00';
      const mainReport = selectedTaskInfo.task.history?.find((h) => {
        const matchesMain = h.isSupportReport !== true;
        const matchesDate = h.date?.split("T")[0] === reportDate;
        if (!matchesMain || !matchesDate) return false;
        return !h.revisionId || h.revisionId === taskCurrentRev;
      });
      if (mainReport?.photos) {
        if (!Array.isArray(mainReport.photos)) {
          const pObj = mainReport.photos as any;
          return (pObj.site || []).filter(Boolean);
        } else {
          return (mainReport.photos as string[]).filter(Boolean);
        }
      }
    }
    return [];
  }, [sitePhotos, selectedTaskInfo, reportDate]);

  const isShowingMainPhotosFallback = React.useMemo(() => {
    if (sitePhotos.filter(Boolean).length > 0) return false;
    if (!selectedTaskInfo?.task?.isHelper) return false;

    const taskCurrentRev = selectedTaskInfo.task.currentRevision || 'rev00';
    const mainReport = selectedTaskInfo.task.history?.find((h) => {
      const matchesMain = h.isSupportReport !== true;
      const matchesDate = h.date?.split("T")[0] === reportDate;
      if (!matchesMain || !matchesDate) return false;
      return !h.revisionId || h.revisionId === taskCurrentRev;
    });
    
    if (!mainReport?.photos) return false;
    if (Array.isArray(mainReport.photos)) {
      return mainReport.photos.filter(Boolean).length > 0;
    }
    const pObj = mainReport.photos as any;
    return (pObj.site || []).filter(Boolean).length > 0;
  }, [sitePhotos, selectedTaskInfo, reportDate]);

  const mainReportForShiftPhotos = React.useMemo(() => {
    if (!selectedTaskInfo?.task?.isHelper) return null;
    // For helper tasks: find the MAIN foreman's history entry for this date
    // Use relaxed matching - don't require revisionId match since main foreman may have different revision
    return selectedTaskInfo.task.history?.find((h) => {
      const matchesMain = h.isSupportReport !== true;
      const matchesDate = h.date?.split("T")[0] === reportDate;
      if (!matchesMain || !matchesDate) return false;
      // Accept if revisionId matches OR if revisionId is not set (older data)
      const taskCurrentRev = selectedTaskInfo.task.currentRevision || 'rev00';
      return !h.revisionId || h.revisionId === taskCurrentRev;
    });
  }, [selectedTaskInfo, reportDate]);

  const referenceLabor = React.useMemo(() => {
    if (labor.length > 0) return labor;
    if (selectedTaskInfo?.task?.isHelper) {
      return mainReportForShiftPhotos?.labor || [];
    }
    return [];
  }, [labor, selectedTaskInfo, mainReportForShiftPhotos]);

  const displayRegularPhotos = React.useMemo(() => {
    const ownPhotos = laborRegularPhotos.filter(Boolean);
    if (ownPhotos.length > 0) return ownPhotos;

    if (mainReportForShiftPhotos?.photos && !Array.isArray(mainReportForShiftPhotos.photos)) {
      const pObj = mainReportForShiftPhotos.photos as any;
      const dbShift = pObj.laborByShift?.regular;
      if (dbShift) {
        if (Array.isArray(dbShift)) {
          return dbShift.filter(Boolean);
        }
        return [
          dbShift.in || "",
          dbShift.lunch || "",
          dbShift.afternoon || "",
          dbShift.out || "",
        ].filter(Boolean);
      }
    } else if (mainReportForShiftPhotos?.laborPhotos) {
      return mainReportForShiftPhotos.laborPhotos.filter(Boolean);
    }
    return [];
  }, [laborRegularPhotos, mainReportForShiftPhotos]);

  const displayOtMorningPhotos = React.useMemo(() => {
    const ownPhotos = laborOtMorningPhotos.filter(Boolean);
    if (ownPhotos.length > 0) return ownPhotos;

    if (mainReportForShiftPhotos?.photos && !Array.isArray(mainReportForShiftPhotos.photos)) {
      const pObj = mainReportForShiftPhotos.photos as any;
      const dbShift = pObj.laborByShift?.otMorning;
      if (dbShift) {
        if (Array.isArray(dbShift)) {
          return dbShift.filter(Boolean);
        }
        return [dbShift.in || "", dbShift.out || ""].filter(Boolean);
      }
    }
    return [];
  }, [laborOtMorningPhotos, mainReportForShiftPhotos]);

  const displayOtNoonPhotos = React.useMemo(() => {
    const ownPhotos = laborOtNoonPhotos.filter(Boolean);
    if (ownPhotos.length > 0) return ownPhotos;

    if (mainReportForShiftPhotos?.photos && !Array.isArray(mainReportForShiftPhotos.photos)) {
      const pObj = mainReportForShiftPhotos.photos as any;
      const dbShift = pObj.laborByShift?.otNoon;
      if (dbShift) {
        if (Array.isArray(dbShift)) {
          return dbShift.filter(Boolean);
        }
        return [dbShift.in || "", dbShift.out || ""].filter(Boolean);
      }
    }
    return [];
  }, [laborOtNoonPhotos, mainReportForShiftPhotos]);

  const displayOtEveningPhotos = React.useMemo(() => {
    const ownPhotos = laborOtEveningPhotos.filter(Boolean);
    if (ownPhotos.length > 0) return ownPhotos;

    if (mainReportForShiftPhotos?.photos && !Array.isArray(mainReportForShiftPhotos.photos)) {
      const pObj = mainReportForShiftPhotos.photos as any;
      const dbShift = pObj.laborByShift?.otEvening;
      if (dbShift) {
        if (Array.isArray(dbShift)) {
          return dbShift.filter(Boolean);
        }
        return [dbShift.in || "", dbShift.out || ""].filter(Boolean);
      }
    }
    return [];
  }, [laborOtEveningPhotos, mainReportForShiftPhotos]);

  // Helper render functions with lexical scope access
  const renderTimeInput = (id: string, shift: string, rangeStr: string) => {
    const [start, end] = rangeStr.split(" - ").map((s) => s.trim());
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          pointerEvents: isEditingExisting ? "auto" : "none",
        }}
      >
        <div
          onClick={() => openTimePicker(id, shift, "start")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "#334155",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <Clock size={12} color="#94a3b8" />
          {start}
        </div>
        <span style={{ color: "#cbd5e1", fontWeight: 700 }}>-</span>
        <div
          onClick={() => openTimePicker(id, shift, "end")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "#334155",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          {end}
        </div>
      </div>
    );
  };

  const renderLeaveTimeInput = (id: string, rangeStr: string) => {
    const [start, end] = rangeStr.split(" - ").map((s) => s.trim());
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          pointerEvents: isEditingExisting ? "auto" : "none",
        }}
      >
        <div
          onClick={() => openTimePicker(id, "leave", "start")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: "8px",
            padding: "2px 6px",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "#e11d48",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <Clock size={12} color="#f43f5e" />
          {start}
        </div>
        <span style={{ color: "#fecdd3", fontWeight: 700 }}>-</span>
        <div
          onClick={() => openTimePicker(id, "leave", "end")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: "8px",
            padding: "2px 6px",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "#e11d48",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          {end}
        </div>
      </div>
    );
  };
  // Renders the Detail Column JSX
  return (
      <div
        style={{
          background: "#fff",
          borderRadius: "24px",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          height: "100%",
        }}
      >
        {!selectedTaskInfo ? (
           <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {!isSidebarOpen && (
               <button
                onClick={() => setIsSidebarOpen(true)}
                style={{
                  position: "absolute",
                  top: "20px",
                  left: "20px",
                  background: "#eff6ff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  padding: "8px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  color: "#2563eb",
                  boxShadow: "0 4px 6px -1px rgba(59,130,246,0.1)",
                  transition: "all 0.2s",
                  zIndex: 10,
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "#dbeafe")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "#eff6ff")
                }
              >
                {" "}
                
                <ChevronRight size={16} strokeWidth={2.5} /> แสดงรายการงาน
              </button>
            )}{" "}
            
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
              }}
            >
              {" "}
              
              <LayoutDashboard
                size={64}
                style={{
                  opacity: 0.1,
                  marginBottom: "1.5rem",
                }}
              />{" "}
              
              <h3
                style={{
                  margin: 0,
                  fontWeight: 800,
                }}
              >
                เลือกรายการงานที่ต้องการรายงานผล
              </h3>{" "}
              
              <p
                style={{
                  margin: "8px 0 0 0",
                  fontSize: "0.9rem",
                }}
              >
                รายการงานที่ท่านได้รับมอบหมายจะแสดงในแถบด้านซ้าย
              </p>
            </div>
          </div>
        ) : (
           <Fragment>
            {" "}
            
            <div
              style={{
                padding: "1rem 1.5rem",
                borderBottom: "1px solid #f1f5f9",
                background: "#f8fafc",
                flexShrink: 0,
              }}
            >
              {" "}
              
              <div
                style={{
                  background: "#fff",
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                  overflow: "visible",
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  height: isMobile ? "auto" : "220px",
                }}
              >
                {" "}
                
                {(!isMobile || !isCardCollapsed) && <div
                  style={{
                    width: isMobile ? "100%" : "190px",
                    height: isMobile ? "170px" : undefined,
                    background: "#f1f5f9",
                    position: "relative",
                    flexShrink: 0,
                    borderTopLeftRadius: "15px",
                    borderBottomLeftRadius: isMobile ? "0" : "15px",
                    borderTopRightRadius: isMobile ? "15px" : "0",
                    overflow: "hidden",
                  }}
                >
                  {getTaskImage(selectedTaskInfo.task) ? (
                                                     <img
                                                      src={getTaskImage(selectedTaskInfo.task) || undefined}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        if (isMobile) {
                          setPhotoPreviewOpen(true);
                          setPhotoPreviewUrl(getTaskImage(selectedTaskInfo.task));
                        } else {
                          setZoomImage(getTaskImage(selectedTaskInfo.task));
                        }
                      }}
                      alt="Task"
                    />
                  ) : (
                     <div
                      style={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#cbd5e1",
                      }}
                    >
                      {" "}
                      
                      <AlertCircle size={24} />
                    </div>
                  )}{" "}
                  
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      left: 8,
                      background: "rgba(0,0,0,0.6)",
                      color: "#fff",
                      fontSize: "0.65rem",
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    BEFORE
                  </div>
                </div>}{" "}

                <div
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  {" "}
                  
                  <div
                    style={{
                      display: "flex",
                      flexDirection: isMobile ? "column" : "row",
                      justifyContent: "space-between",
                      alignItems: "stretch",
                      height: isMobile ? "auto" : "100%",
                    }}
                  >
                    {" "}
                    
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                      }}
                    >
                      {" "}
                      
                      <div style={{ position: isMobile ? "relative" : undefined }}>
                        {isMobile && (
                          <div style={{ position: "absolute", top: 0, right: 0, display: "flex", gap: "6px", alignItems: "center" }}>
                            <button
                              onClick={() => setShowSLAPopup(true)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                background: "#eff6ff",
                                border: "1px solid #bfdbfe",
                                borderRadius: "8px",
                                padding: "4px 10px",
                                cursor: "pointer",
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                color: "#2563eb",
                                minWidth: "44px",
                                minHeight: "44px",
                                justifyContent: "center",
                              }}
                            >
                              <Clock size={12} />
                              SLA
                            </button>
                            <button
                              onClick={() => setIsCardCollapsed(c => !c)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#f1f5f9",
                                border: "1px solid #e2e8f0",
                                borderRadius: "8px",
                                padding: "4px 8px",
                                cursor: "pointer",
                                minWidth: "36px",
                                minHeight: "44px",
                                color: "#64748b",
                              }}
                              aria-label={isCardCollapsed ? "ขยายการ์ด" : "ยุบการ์ด"}
                            >
                              {isCardCollapsed ? <ChevronDown size={16} strokeWidth={2.5} /> : <ChevronUp size={16} strokeWidth={2.5} />}
                            </button>
                          </div>
                        )}
                        {!isSidebarOpen && (
                          <div style={{ marginBottom: "8px" }}>
                            <button
                              onClick={() => setIsSidebarOpen(true)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                background: "#eff6ff",
                                border: "1px solid #dbeafe",
                                borderRadius: "8px",
                                padding: "4px 10px",
                                cursor: "pointer",
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                color: "#2563eb",
                                transition: "all 0.2s",
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = "#dbeafe";
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = "#eff6ff";
                              }}
                            >
                              <ChevronRight size={12} strokeWidth={2.5} />
                              แสดงรายการงาน
                            </button>
                          </div>
                        )}

                        <h2
                          style={{
                            margin: 0,
                            fontSize: "1.1rem",
                            fontWeight: 900,
                            color: "#0f172a",
                            lineHeight: 1.2,
                            display: "flex",
                            alignItems: isMobile ? "flex-start" : "center",
                            gap: "8px",
                            flexWrap: "wrap",
                            flexDirection: isMobile ? "column" : "row",
                          }}
                        >
                          {" "}
                          <span>{selectedTaskInfo.task.isHelper ? (selectedTaskInfo.task.subtaskName || selectedTaskInfo.task.name) : (selectedTaskInfo.task.name || selectedTaskInfo.task.taskName)}</span>

                          {isMobile ? (
                            <div style={{ display: "flex", flexDirection: "row", gap: "6px", flexWrap: "wrap" }}>
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  fontWeight: 800,
                                  color: "#166534",
                                  background: "#f0fdf4",
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #dcfce7",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <Package size={10} color="#15803d" />
                                {selectedTaskInfo.task.amount || 1} {selectedTaskInfo.task.unit || "จุด"}
                              </span>
                              {selectedTaskInfo.task.currentRevision &&
                                selectedTaskInfo.task.currentRevision !== "rev00" && (
                                  <span
                                    style={{
                                      color: "#ef4444",
                                      fontWeight: 900,
                                      background: "#fef2f2",
                                      padding: "2px 8px",
                                      borderRadius: "6px",
                                      border: "1px solid #fca5a5",
                                      fontSize: "0.68rem",
                                    }}
                                  >
                                    REV. {parseInt(
                                      selectedTaskInfo.task.currentRevision.replace("rev", ""),
                                    )}
                                  </span>
                                )}
                            </div>
                          ) : (
                            <>
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  fontWeight: 800,
                                  color: "#166534",
                                  background: "#f0fdf4",
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #dcfce7",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <Package size={10} color="#15803d" />
                                {selectedTaskInfo.task.amount || 1} {selectedTaskInfo.task.unit || "จุด"}
                              </span>
                              {selectedTaskInfo.task.currentRevision &&
                                selectedTaskInfo.task.currentRevision !== "rev00" && (
                                  <span
                                    style={{
                                      color: "#ef4444",
                                      fontWeight: 900,
                                      background: "#fef2f2",
                                      padding: "2px 8px",
                                      borderRadius: "6px",
                                      border: "1px solid #fca5a5",
                                      fontSize: "0.68rem",
                                    }}
                                  >
                                    REV. {parseInt(
                                      selectedTaskInfo.task.currentRevision.replace("rev", ""),
                                    )}
                                  </span>
                                )}
                            </>
                          )}
                        </h2>

                        {(!isMobile || !isCardCollapsed) && <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            marginTop: "8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", fontSize: "0.78rem" }}>
                            <span style={{ fontWeight: 700, color: "#64748b", width: "80px", flexShrink: 0 }}>รหัสใบงาน:</span>
                            <span style={{ fontWeight: 800, color: "#1e293b", fontFamily: "monospace" }}>
                              {selectedTaskInfo.wo.id || "-"}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", fontSize: "0.78rem" }}>
                            <span style={{ fontWeight: 700, color: "#64748b", width: "80px", flexShrink: 0 }}>รหัสงาน:</span>
                            <span style={{ fontWeight: 800, color: "#1e293b", fontFamily: "monospace" }}>
                              {formatSubtaskId(selectedTaskInfo.task.subtaskId || selectedTaskInfo.task.id) || "-"}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", fontSize: "0.78rem" }}>
                            <span style={{ fontWeight: 700, color: "#64748b", width: "80px", flexShrink: 0 }}>โครงการ:</span>
                            <span style={{ fontWeight: 800, color: "#1e293b" }}>
                              {(() => {
                                const project = realProjects.find((p) => p.id === selectedTaskInfo.wo.projectId);
                                return project ? project.name : "-";
                              })()}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", fontSize: "0.78rem" }}>
                            <span style={{ fontWeight: 700, color: "#64748b", width: "80px", flexShrink: 0 }}>สถานที่:</span>
                            <span style={{ fontWeight: 800, color: "#1e293b" }}>
                              {(() => {
                                const parts = [];
                                if (selectedTaskInfo.wo.building) parts.push("อาคาร " + selectedTaskInfo.wo.building);
                                if (selectedTaskInfo.wo.floor) parts.push("ชั้น " + selectedTaskInfo.wo.floor);
                                if (selectedTaskInfo.wo.room) parts.push("ห้อง " + selectedTaskInfo.wo.room);
                                return parts.length > 0 ? parts.join(" / ") : "-";
                              })()}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", fontSize: "0.78rem" }}>
                            <span style={{ fontWeight: 700, color: "#64748b", width: "80px", flexShrink: 0 }}>หมวดงาน:</span>
                            <span style={{ fontWeight: 800, color: "#1e293b" }}>
                              {(() => {
                                const category = selectedTaskInfo.wo.categories.find((c) => c.id === selectedTaskInfo.categoryId);
                                return category ? category.name : "-";
                              })()}
                            </span>
                          </div>
                        </div>}
                      </div>
                    </div> {" "}
                    
                    <div
                      style={{
                        display: isMobile ? "none" : "flex",
                        flexDirection: "column",
                        gap: "6px",
                        alignItems: "flex-end",
                        minWidth: "200px",
                        marginLeft: "20px",
                        marginTop: 0,
                      }}
                    >
                      {(() => {
                        const isHelperTask = selectedTaskInfo.task.isHelper === true;
                        const slaDuration = (selectedTaskInfo.task.slaCategory && SLA_HOURS_MAP[selectedTaskInfo.task.slaCategory]) || 24;
                        let globalDeadlineTime: number | undefined = undefined;
                        const woId = selectedTaskInfo.wo.id;

                        if (isHelperTask) {
                          const helperDue = selectedTaskInfo.task.dueDate ? new Date(selectedTaskInfo.task.dueDate).getTime() : 0;
                          if (helperDue > 0) {
                            globalDeadlineTime = helperDue;
                          }
                        } else {
                          const fullWo = workOrders.find((w) => w.id === woId);
                          if (fullWo) {
                            const jobSla = computeJobSLA(fullWo);
                            if (jobSla.deadlineMs) {
                              globalDeadlineTime = jobSla.deadlineMs;
                            }
                          }
                        }
                        const isCompleted100 =
                          (selectedTaskInfo.task.dailyProgress || 0) >= 100;
                        const appointmentDateVal =
                          selectedTaskInfo.wo.appointmentDate ||
                          selectedTaskInfo.task.startDate;
                        let actualStartVal: string | undefined = undefined;
                        if (
                          selectedTaskInfo.task.history &&
                          selectedTaskInfo.task.history.length > 0
                        ) {
                          const history = selectedTaskInfo.task.history || [];
                          const filteredHistory = filterHistoryByRevision(history, selectedTaskInfo.task.revisionCreatedAt, selectedTaskInfo.task.currentRevision);
                          const sortedHistory = [...filteredHistory]
                            .filter((h) => h.date)
                            .sort(
                              (a, b) =>
                                new Date(a.date).getTime() -
                                new Date(b.date).getTime(),
                            );
                          if (sortedHistory.length > 0) {
                            actualStartVal = sortedHistory[0].date;
                          }
                        }
                        return (
                           <div
                            style={{
                              width: "100%",
                            }}
                          >
                            {" "}
                            
                            <SLACountdown
                              startTime={
                                isHelperTask
                                  ? (selectedTaskInfo.task.dueDate || new Date().toISOString())
                                  : ((selectedTaskInfo.task.startDate && typeof selectedTaskInfo.task.startDate === 'string'
                                      ? `${selectedTaskInfo.task.startDate.split('T')[0]}T08:00:00+07:00`
                                      : selectedTaskInfo.task.slaStartTime) ||
                                     new Date().toISOString())
                              }
                              durationHours={isHelperTask ? 0 : slaDuration}
                              appointmentDate={appointmentDateVal || void 0}
                              actualStartDate={actualStartVal || void 0}
                              isCompleted={isCompleted100}
                              groupDeadline={globalDeadlineTime}
                              isHelper={isHelperTask}
                            />
                          </div>
                        );
                      })()} 

                      {selectedTaskInfo.task.isHelper ? null : selectedTaskInfo.task.isSupportRequest ? (
                        selectedTaskInfo.task.isPickedUpBySupport ? (
                          <div
                            style={{
                              width: "100%",
                              padding: "6px 12px",
                              background: "#f0fdf4",
                              border: "1px solid #bbf7d0",
                              borderRadius: "12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              color: "#166534",
                            }}
                          >
                            🤝 มีผู้ช่วยงานแล้ว
                          </div>
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              padding: "6px 12px",
                              background: "#fffbeb",
                              border: "1px solid #fef3c7",
                              borderRadius: "12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              color: "#b45309",
                            }}
                          >
                            📢 ส่งขอความช่วยเหลือแล้ว
                          </div>
                        )
                      ) : null}
                      
                      <div
                        style={{
                          width: "100%",
                          padding: "6px 12px",
                          background: "#f8fafc",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          position: "relative",
                        }}
                      >
                        {" "}
                        
                        <div
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 900,
                            color: "#94a3b8",
                            textTransform: "uppercase",
                          }}
                        >
                          รายงานระบุวันที่
                        </div>{" "}
                        
                        <div
                          onClick={() =>
                            setShowCalendarDropdown(!showCalendarDropdown)
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            color: "#1e40af",
                            fontSize: "0.85rem",
                            fontWeight: 900,
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                        >
                          {" "}
                          
                          <Calendar size={14} /> 
                          <span>
                            {formatDate(reportDate)}
                          </span>
                        </div>
                        {showCalendarDropdown && (
                           <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              right: 0,
                              marginTop: "8px",
                              zIndex: 1e3,
                              background: "#fff",
                              border: "1px solid #cbd5e1",
                              borderRadius: "16px",
                              boxShadow:
                                "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                              padding: "16px",
                              width: "280px",
                            }}
                          >
                            {" "}
                            
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "12px",
                              }}
                            >
                              {" "}
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (calendarMonth === 0) {
                                    setCalendarMonth(11);
                                    setCalendarYear((prev) => prev - 1);
                                  } else {
                                    setCalendarMonth((prev) => prev - 1);
                                  }
                                }}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  color: "#64748b",
                                }}
                              >
                                {" "}
                                
                                <ChevronLeft size={16} />
                              </button>{" "}
                              
                              <span
                                style={{
                                  fontSize: "0.85rem",
                                  fontWeight: 800,
                                  color: "#1e293b",
                                }}
                              >
                                {
                                  [
                                    "มกราคม",
                                    "กุมภาพันธ์",
                                    "มีนาคม",
                                    "เมษายน",
                                    "พฤษภาคม",
                                    "มิถุนายน",
                                    "กรกฎาคม",
                                    "สิงหาคม",
                                    "กันยายน",
                                    "ตุลาคม",
                                    "พฤศจิกายน",
                                    "ธันวาคม",
                                  ][calendarMonth]
                                }{" "}
                                {calendarYear}
                              </span>{" "}
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (calendarMonth === 11) {
                                    setCalendarMonth(0);
                                    setCalendarYear((prev) => prev + 1);
                                  } else {
                                    setCalendarMonth((prev) => prev + 1);
                                  }
                                }}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  color: "#64748b",
                                }}
                              >
                                {" "}
                                
                                <ChevronRight size={16} />
                              </button>
                            </div>{" "}
                            
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(7, 1fr)",
                                gap: "4px",
                                textAlign: "center",
                                marginBottom: "8px",
                              }}
                            >
                              {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map(
                                (day, i) => (
                                   <span
                                    style={{
                                      fontSize: "0.7rem",
                                      fontWeight: 800,
                                      color: "#94a3b8",
                                    }}
                                    key={i}
                                  >
                                    {day}
                                  </span>
                                ),
                              )}
                            </div>{" "}
                            
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(7, 1fr)",
                                gap: "4px",
                                textAlign: "center",
                              }}
                            >
                              {Array.from({
                                length: new Date(
                                  calendarYear,
                                  calendarMonth,
                                  1,
                                ).getDay(),
                              }).map((_, idx) => (
                                 <div
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                  }}
                                  key={`blank-${idx}`}
                                />
                              ))}
                              {Array.from({
                                length: new Date(
                                  calendarYear,
                                  calendarMonth + 1,
                                  0,
                                ).getDate(),
                              }).map((_, idx) => {
                                const day = idx + 1;
                                const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                const status = getDateStatus(
                                  dateStr,
                                  selectedTaskInfo.task,
                                  selectedTaskInfo.wo,
                                );
                                let dotColor = "";
                                if (status === "reported") dotColor = "#10b981";
                                else if (status === "unlocked")
                                  dotColor = "#f59e0b";
                                else if (status === "locked")
                                  dotColor = "#ef4444";
                                const isSelected = reportDate === dateStr;
                                const isDisabled = status === "disabled";
                                return (
                                   <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isDisabled) return;
                                      if (status === "locked") {
                                        setPendingUnlockDate(dateStr);
                                        setUnlockReason("");
                                        setShowUnlockModal(true);
                                        setShowCalendarDropdown(false);
                                      } else {
                                        handleDateChange(dateStr);
                                        setShowCalendarDropdown(false);
                                      }
                                    }}
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      borderRadius: "8px",
                                      fontSize: "0.75rem",
                                      fontWeight: 800,
                                      cursor: isDisabled
                                        ? "not-allowed"
                                        : "pointer",
                                      position: "relative",
                                      background: isSelected
                                        ? "#3b82f6"
                                        : "transparent",
                                      color: isDisabled
                                        ? "#cbd5e1"
                                        : isSelected
                                          ? "#fff"
                                          : "#334155",
                                      opacity: isDisabled ? 0.6 : 1,
                                      transition: "all 0.15s",
                                    }}
                                    onMouseOver={(e) => {
                                      if (!isDisabled && !isSelected) {
                                        e.currentTarget.style.background =
                                          "#f1f5f9";
                                      }
                                    }}
                                    onMouseOut={(e) => {
                                      if (!isDisabled && !isSelected) {
                                        e.currentTarget.style.background =
                                          "transparent";
                                      }
                                    }}
                                    key={`day-${day}`}
                                  >
                                    {day}
                                    {dotColor && (
                                       <div
                                        style={{
                                          position: "absolute",
                                          bottom: "3px",
                                          width: "4px",
                                          height: "4px",
                                          borderRadius: "50%",
                                          background: isSelected
                                            ? "#fff"
                                            : dotColor,
                                        }}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>{" "}
                            
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginTop: "16px",
                                paddingTop: "12px",
                                borderTop: "1px solid #f1f5f9",
                                fontSize: "0.65rem",
                                fontWeight: 800,
                              }}
                            >
                              {" "}
                              
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  color: "#64748b",
                                }}
                              >
                                {" "}
                                
                                <span
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background: "#10b981",
                                  }}
                                />{" "}
                                <span>มีข้อมูล</span>
                              </div>{" "}
                              
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  color: "#64748b",
                                }}
                              >
                                {" "}
                                
                                <span
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background: "#f59e0b",
                                  }}
                                />{" "}
                                <span>ยังไม่ได้ลง</span>
                              </div>{" "}
                              
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  color: "#64748b",
                                }}
                              >
                                {" "}
                                
                                <span
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background: "#ef4444",
                                  }}
                                />{" "}
                                <span>ไม่มีข้อมูล</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>{" "}
            
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: isMobile ? "1rem" : "2rem",
              }}
            >
              {isAwaitingAdmin ? (
                <div
                  style={{
                    background: "#fff5f5",
                    border: "1.5px solid #fecaca",
                    borderRadius: "20px",
                    padding: "24px",
                    boxShadow: "0 10px 15px -3px rgba(220, 38, 38, 0.05)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        background: "#fee2e2",
                        padding: "10px",
                        borderRadius: "12px",
                        color: "#dc2626",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, color: "#991b1b" }}>
                        ⚠️ อยู่ระหว่างรอแอดมินมอบหมายตารางเวลาใหม่
                      </h3>
                      <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#b91c1c", fontWeight: 600 }}>
                        ใบงานนี้ถูกระงับการกรอกรายงานผลชั่วคราว เพื่อรอให้แอดมินจัดสรรรอบเวลาการแก้ไขงานใหม่
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "1px dashed #fca5a5",
                      paddingTop: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#7f1d1d", textTransform: "uppercase" }}>
                      เหตุผลที่โดนปฏิเสธ (Rejection Reason)
                    </div>
                    <div
                      style={{
                        background: "#ffffff",
                        border: "1px solid #fee2e2",
                        borderRadius: "12px",
                        padding: "16px",
                        color: "#3f0712",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.02)",
                      }}
                    >
                      {selectedTaskInfo?.task?.rejectReason || selectedTaskInfo?.task?.reason || "ไม่ได้ระบุเหตุผลการปฏิเสธ"}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#fffbeb",
                      border: "1px solid #fef3c7",
                      borderRadius: "12px",
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      fontSize: "0.78rem",
                      color: "#b45309",
                      fontWeight: 700,
                    }}
                  >
                    <Info size={16} />
                    <span>ท่านจะเริ่มบันทึกและกรอกรายละเอียดความคืบหน้าได้อีกครั้ง เมื่อแอดมินจัดส่งตารางงานแก้ไขกลับมาให้เรียบร้อยแล้ว</span>
                  </div>
                </div>
              ) : (
                <Fragment>
                  {isMobile && (
                    <div style={{ position: "relative", marginBottom: "1rem" }}>
                      <div
                        style={{
                          width: "100%",
                          padding: "8px 14px",
                          background: "#f8fafc",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ fontSize: "0.72rem", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase" }}>
                          รายงานระบุวันที่
                        </span>
                        <div
                          onClick={() => setShowCalendarDropdown(!showCalendarDropdown)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            color: "#1e40af",
                            fontSize: "0.85rem",
                            fontWeight: 900,
                            cursor: "pointer",
                            userSelect: "none",
                            minHeight: "36px",
                            padding: "0 4px",
                          }}
                        >
                          <Calendar size={14} />
                          <span>{formatDate(reportDate)}</span>
                        </div>
                      </div>
                      {showCalendarDropdown && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            right: 0,
                            marginTop: "8px",
                            zIndex: 1000,
                            background: "#fff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "16px",
                            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                            padding: "16px",
                            width: "280px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(prev => prev - 1); }
                                else setCalendarMonth(prev => prev - 1);
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "6px", color: "#64748b", fontSize: "1rem" }}
                            >‹</button>
                            <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#1e293b" }}>
                              {["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"][calendarMonth]} {calendarYear}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(prev => prev + 1); }
                                else setCalendarMonth(prev => prev + 1);
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "6px", color: "#64748b", fontSize: "1rem" }}
                            >›</button>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 32px)", gap: "2px", justifyContent: "center" }}>
                            {["อา","จ","อ","พ","พฤ","ศ","ส"].map(d => (
                              <div key={d} style={{ width: "32px", textAlign: "center", fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", paddingBottom: "4px" }}>{d}</div>
                            ))}
                            {Array.from({ length: new Date(calendarYear, calendarMonth, 1).getDay() }).map((_, i) => (
                              <div key={`b-${i}`} style={{ width: "32px", height: "32px" }} />
                            ))}
                            {Array.from({ length: new Date(calendarYear, calendarMonth + 1, 0).getDate() }).map((_, idx) => {
                              const day = idx + 1;
                              const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                              const status = getDateStatus(dateStr, selectedTaskInfo.task, selectedTaskInfo.wo);
                              const isSelected = reportDate === dateStr;
                              const isDisabled = status === "disabled";
                              let dotColor = "";
                              if (status === "reported") dotColor = "#10b981";
                              else if (status === "unlocked") dotColor = "#f59e0b";
                              else if (status === "locked") dotColor = "#ef4444";
                              return (
                                <div
                                  key={dateStr}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isDisabled) return;
                                    if (status === "locked") {
                                      setPendingUnlockDate(dateStr);
                                      setUnlockReason("");
                                      setShowUnlockModal(true);
                                      setShowCalendarDropdown(false);
                                    } else {
                                      handleDateChange(dateStr);
                                      setShowCalendarDropdown(false);
                                    }
                                  }}
                                  style={{
                                    width: "32px", height: "32px",
                                    display: "flex", flexDirection: "column",
                                    alignItems: "center", justifyContent: "center",
                                    borderRadius: "8px",
                                    fontSize: "0.75rem", fontWeight: 800,
                                    cursor: isDisabled ? "not-allowed" : "pointer",
                                    position: "relative",
                                    background: isSelected ? "#3b82f6" : "transparent",
                                    color: isDisabled ? "#cbd5e1" : isSelected ? "#fff" : "#334155",
                                    opacity: isDisabled ? 0.6 : 1,
                                  }}
                                >
                                  {day}
                                  {dotColor && (
                                    <span style={{ position: "absolute", bottom: "2px", width: "4px", height: "4px", borderRadius: "50%", background: isSelected ? "#fff" : dotColor }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9", fontSize: "0.65rem", fontWeight: 800 }}>
                            {[["#10b981","มีข้อมูล"],["#f59e0b","ยังไม่ได้ลง"],["#ef4444","ไม่มีข้อมูล"]].map(([color, label]) => (
                              <div key={label} style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b" }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "inline-block" }} />
                                {label}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedTaskInfo?.task?.isReadOnly && (
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1.5px solid #cbd5e1",
                        borderRadius: "20px",
                        padding: "16px 20px",
                        marginBottom: "1.5rem",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          background: "#e2e8f0",
                          padding: "8px",
                          borderRadius: "10px",
                          color: "#475569",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Lock size={18} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 900, color: "#334155" }}>
                          โหมดดูข้อมูลอย่างเดียว (Read-Only Mode)
                        </h4>
                        <p style={{ margin: "2px 0 0 0", fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                          คุณไม่ได้เป็นผู้รับผิดชอบงานย่อยนี้ในรอบการแก้งานปัจจุบัน จึงสามารถดูข้อมูลได้อย่างเดียวเท่านั้น
                        </p>
                      </div>
                    </div>
                  )}
                  {isReportDatePast3Days && !retroactiveSubmitDone && (
                    <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "16px", padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ background: "#ffedd5", padding: "8px", borderRadius: "10px", color: "#ea580c", flexShrink: 0, display: "flex", alignItems: "center" }}>
                        <AlertCircle size={18} />
                      </div>
                      <div>
                        <h4 style={{ margin: "0 0 2px 0", color: "#c2410c", fontSize: "0.88rem", fontWeight: 900 }}>รายงานย้อนหลัง — ต้องผ่านการรับรอง</h4>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "#ea580c", fontWeight: 600, lineHeight: 1.5 }}>
                          กรอกข้อมูลได้ตามปกติ เมื่อกด <strong>"ส่งขอรับรอง"</strong> ข้อมูลจะถูกส่งให้ผู้รับผิดชอบอนุมัติก่อนบันทึกลงระบบ
                        </p>
                      </div>
                    </div>
                  )}
                  {isReportDatePast3Days && retroactiveSubmitDone && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "16px", padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ background: "#dcfce7", padding: "8px", borderRadius: "10px", color: "#16a34a", flexShrink: 0 }}>
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h4 style={{ margin: "0 0 2px 0", color: "#15803d", fontSize: "0.88rem", fontWeight: 900 }}>ส่งคำขอรับรองแล้ว</h4>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "#16a34a", fontWeight: 600 }}>รอผู้รับผิดชอบอนุมัติ ข้อมูลจะปรากฏหลังได้รับการอนุมัติ</p>
                      </div>
                      <button onClick={() => setRetroactiveSubmitDone(false)} style={{ marginLeft: "auto", fontSize: "0.75rem", padding: "4px 10px", borderRadius: "8px", border: "1px solid #bbf7d0", background: "#fff", color: "#15803d", cursor: "pointer", fontWeight: 700 }}>แก้ไขใหม่</button>
                    </div>
                  )}
              {selectedTaskInfo.task.estimatedSla &&
                selectedTaskInfo.task.slaCategory &&
                selectedTaskInfo.task.estimatedSla !==
                  selectedTaskInfo.task.slaCategory &&
                (!selectedTaskInfo.task.currentRevision || selectedTaskInfo.task.currentRevision === 'rev00') &&
                (selectedTaskInfo.task.dailyProgress || 0) === 0 && (
                   <div
                    style={{
                      background: "#fff7ed",
                      border: "1px solid #fed7aa",
                      borderRadius: "12px",
                      padding: "1.25rem",
                      marginBottom: "2rem",
                      display: "flex",
                      flexDirection: isMobile ? "column" : "row",
                      justifyContent: "space-between",
                      alignItems: isMobile ? "stretch" : "center",
                      gap: isMobile ? "12px" : 0,
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                    }}
                  >
                    {" "}
                    
                    <div
                      style={{
                        display: "flex",
                        gap: "1rem",
                        alignItems: "center",
                      }}
                    >
                      {" "}
                      
                      <div
                        style={{
                          background: "#ffedd5",
                          padding: "10px",
                          borderRadius: "12px",
                          color: "#f97316",
                        }}
                      >
                        {" "}
                        
                        <AlertTriangle size={24} />
                      </div>{" "}
                      
                      <div>
                        {" "}
                        
                        <h4
                          style={{
                            margin: "0 0 4px 0",
                            color: "#9a3412",
                            fontSize: "0.95rem",
                            fontWeight: 900,
                          }}
                        >
                          SLA ไม่ตรงตามที่คาดการณ์
                        </h4>{" "}
                        
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.85rem",
                            color: "#c2410c",
                            fontWeight: 500,
                          }}
                        >
                          คุณขอ: 
                          <span
                            style={{
                              fontWeight: 800,
                            }}
                          >
                            {selectedTaskInfo.task.estimatedSla}
                          </span>{" "}
                          | แอดมินระบุ: 
                          <span
                            style={{
                              fontWeight: 800,
                            }}
                          >
                            {selectedTaskInfo.task.slaCategory}
                          </span>
                        </p>
                      </div>
                    </div>{" "}
                    
                    <button
                      onClick={() =>
                        handleBounceBackSLA(
                          selectedTaskInfo.wo.id,
                          selectedTaskInfo.categoryId,
                          selectedTaskInfo.task.id,
                        )
                      }
                      disabled={isSubmitting}
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        padding: "10px 18px",
                        borderRadius: "10px",
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)",
                        transition: "all 0.2s",
                      }}
                    >
                      {" "}
                      
                      <XCircle size={18} /> ตีกลับให้ประเมินใหม่
                    </button>
                  </div>
                )}{" "}
              
              <section
                style={{
                  marginBottom: "2.5rem",
                }}
              >
                {" "}
                
                <div
                  style={{
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    justifyContent: "space-between",
                    alignItems: isMobile ? "stretch" : "center",
                    gap: isMobile ? "12px" : 0,
                    marginBottom: "1.25rem",
                  }}
                >
                  {" "}

                  <h3
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 900,
                      color: "#0f172a",
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {" "}

                    <Users size={20} color="#3b82f6" /> การจัดการคนงาน (Labor)
                  </h3>{" "}
                  
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    {selectedTaskInfo.task.history?.some(
                      (h) => h.revisionId === (selectedTaskInfo.task.currentRevision || 'rev00') && h.date?.split("T")[0] === reportDate,
                    ) &&
                      !isTaskFinished &&
                      (isEditingExisting ? (
                         <Fragment>
                          {" "}
                          
                          <button
                            onClick={async () => {
                              const confirmSave = window.confirm(
                                "คุณต้องการบันทึกการแก้ไขข้อมูลรายงานรายวันนี้ใช่หรือไม่?",
                              );
                              if (confirmSave) {
                                await handleSubmit();
                              }
                            }}
                            disabled={isSubmitting || isUploading}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              border: "1px solid #10b981",
                              background: "#f0fdf4",
                              color: "#10b981",
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              cursor:
                                isSubmitting || isUploading
                                  ? "not-allowed"
                                  : "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              transition: "all 0.2s",
                            }}
                          >
                            {" "}
                            
                            <CheckCircle2 size={14} /> บันทึกการแก้ไข
                          </button>{" "}
                          
                          <button
                            onClick={handleCancelEdit}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              border: "1px solid #ef4444",
                              background: "#fef2f2",
                              color: "#ef4444",
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              transition: "all 0.2s",
                            }}
                          >
                            {" "}
                            
                            <XCircle size={14} /> ยกเลิก
                          </button>
                        </Fragment>
                      ) : (
                         <button
                          onClick={() => setIsEditingExisting(true)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "1px solid #6366f1",
                            background: "#fff",
                            color: "#6366f1",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            transition: "all 0.2s",
                          }}
                        >
                          {" "}
                          
                          <Edit2 size={14} /> แก้ไขข้อมูล
                        </button>
                      ))}
                    {isEditingExisting && !isTaskFinished && (
                       <Fragment>
                        {" "}
                        
                        <button
                          onClick={() => setActiveModal("Internal")}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "10px",
                            border: "1px solid #2563eb",
                            background: "#2563eb",
                            color: "#fff",
                            fontSize: "0.8rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          {" "}

                          <Plus size={14} /> คนงานบริษัท (Internal)
                        </button>{" "}

                        <button
                          onClick={() => setActiveModal("Outsource")}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "10px",
                            border: "1px solid #0ea5e9",
                            background: "#0ea5e9",
                            color: "#fff",
                            fontSize: "0.8rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          {" "}

                          <Plus size={14} /> ทีมงานผู้รับเหมา (Subco)
                        </button>
                      </Fragment>
                    )}
                  </div>
                </div>{" "}
                
                {!isMobile && (
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "20px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                    overflowX: "auto",
                  }}
                >
                  {displayLabor.length === 0 ? (
                     <div
                      style={{
                        padding: "3rem",
                        textAlign: "center",
                        color: "#94a3b8",
                        fontSize: "0.9rem",
                        fontWeight: 700,
                      }}
                    >
                      {" "}
                      
                      <Users
                        size={32}
                        color="#cbd5e1"
                        style={{
                          marginBottom: "10px",
                        }}
                      />{" "}
                      
                                            {isTaskFinished ? (
                        <Fragment>
                          <div style={{ color: "#0f172a", fontSize: "1rem", marginBottom: "4px" }}>ใบงานนี้ดำเนินการเสร็จสมบูรณ์ 100% แล้ว</div>
                          <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>
                            (ไม่มีการบันทึกรายงานข้อมูลแรงงานสำหรับวันที่เลือก)
                          </div>
                        </Fragment>
                      ) : (
                        <div>ยังไม่มีข้อมูลแรงงาน (กรุณากดปุ่มเพิ่มคนงานด้านบน)</div>
                      )}
                    </div>
                  ) : (
                     <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        textAlign: "left",
                        minWidth: "950px",
                      }}
                    >
                      {" "}
                      
                      <thead>
                        {" "}
                        
                        <tr
                          style={{
                            background: "#f8fafc",
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          {" "}
                          
                          <th
                            style={{
                              padding: "12px 10px",
                              fontSize: "0.8rem",
                              fontWeight: 800,
                              color: "#475569",
                              textAlign: "center",
                              width: "50px",
                            }}
                          >
                            No.
                          </th>{" "}
                          
                          <th
                            style={{
                              padding: "12px 16px",
                              fontSize: "0.8rem",
                              fontWeight: 800,
                              color: "#475569",
                              minWidth: "220px",
                            }}
                          >
                            ชื่อแรงงาน
                          </th>{" "}
                          
                          <th
                            style={{
                              padding: "12px 10px",
                              fontSize: "0.8rem",
                              fontWeight: 800,
                              color: "#475569",
                              textAlign: "center",
                              width: "140px",
                            }}
                          >
                            เวลาทำงานปกติ
                          </th>{" "}
                          
                          <th
                            style={{
                              padding: "12px 10px",
                              fontSize: "0.8rem",
                              fontWeight: 800,
                              color: "#475569",
                              textAlign: "center",
                              width: "140px",
                            }}
                          >
                            OT : เช้า
                          </th>{" "}
                          
                          <th
                            style={{
                              padding: "12px 10px",
                              fontSize: "0.8rem",
                              fontWeight: 800,
                              color: "#475569",
                              textAlign: "center",
                              width: "140px",
                            }}
                          >
                            OT : เที่ยง
                          </th>{" "}
                          
                          <th
                            style={{
                              padding: "12px 10px",
                              fontSize: "0.8rem",
                              fontWeight: 800,
                              color: "#475569",
                              textAlign: "center",
                              width: "140px",
                            }}
                          >
                            OT : เย็น
                          </th>{" "}
                          
                          <th
                            style={{
                              padding: "12px 16px",
                              fontSize: "0.8rem",
                              fontWeight: 800,
                              color: "#475569",
                              minWidth: "200px",
                            }}
                          >
                            Leave : ลา
                          </th>{" "}
                          
                          <th
                            style={{
                              padding: "12px 10px",
                              fontSize: "0.8rem",
                              fontWeight: 800,
                              color: "#475569",
                              textAlign: "center",
                              width: "80px",
                            }}
                          >
                            จัดการ
                          </th>
                        </tr>
                      </thead>{" "}
                      
                      <tbody>
                        {displayLabor.map((l, idx) => (
                           <tr
                            style={{
                              borderBottom: "1px solid #e2e8f0",
                              transition: "all 0.15s",
                            }}
                            key={l.id}
                          >
                            {" "}
                            
                            <td
                              style={{
                                padding: "12px 10px",
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                color: "#64748b",
                                textAlign: "center",
                              }}
                            >
                              {idx + 1}
                            </td>{" "}
                            
                            <td
                              style={{
                                padding: "12px 16px",
                              }}
                            >
                              {" "}
                              
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                {" "}
                                
                                <div
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 8,
                                    background:
                                      l.membership === "Internal"
                                        ? "#eff6ff"
                                        : "#f0fdf4",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {l.membership === "Internal" ? (
                                     <User
                                      size={14}
                                      color="#2563eb"
                                    />
                                  ) : (
                                     <HardHat
                                      size={14}
                                      color="#059669"
                                    />
                                  )}
                                </div>{" "}
                                
                                <div>
                                  {" "}
                                  
                                  <div
                                    style={{
                                      fontSize: "0.85rem",
                                      fontWeight: 800,
                                      color: "#0f172a",
                                    }}
                                  >
                                    {l.employeeId ? `${l.employeeId} : ` : ""}
                                    {l.staffName || l.affiliation}
                                  </div>{" "}
                                  
                                  <div
                                    style={{
                                      fontSize: "0.7rem",
                                      color: "#64748b",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {l.membership === "Internal"
                                      ? "คนงานบริษัท (Internal)"
                                      : "ทีมงานผู้รับเหมา (Subco)"}
                                  </div>
                                </div>
                              </div>
                            </td>{" "}
                            
                            <td
                              style={{
                                padding: "12px 10px",
                                textAlign: "center",
                              }}
                            >
                              {" "}
                              
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "6px",
                                }}
                              >
                                {" "}
                                
                                <div
                                  onClick={() =>
                                    isEditingExisting &&
                                    canEditWorker(l) &&
                                    toggleShift(l.id, "normal")
                                  }
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 4,
                                    border: "2px solid #2563eb",
                                    background: l.shifts?.normal
                                      ? "#2563eb"
                                      : "#fff",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: (isEditingExisting && canEditWorker(l))
                                      ? "pointer"
                                      : "default",
                                    opacity: (isEditingExisting && canEditWorker(l)) ? 1 : 0.6,
                                  }}
                                >
                                  {l.shifts?.normal && (
                                     <CheckCircle2
                                      size={12}
                                      color="#fff"
                                    />
                                  )}
                                </div>
                                {l.shifts?.normal ? (
                                  l.membership === "Internal" ? (
                                    renderTimeInput(
                                      l.id,
                                      "normal",
                                      l.shiftTimes?.day || "08:00 - 17:00",
                                    )
                                  ) : (
                                     <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        background: "#f8fafc",
                                        borderRadius: "8px",
                                        border: "1px solid #e2e8f0",
                                        padding: "2px 6px",
                                        fontSize: "0.75rem",
                                        fontWeight: 700,
                                        color: "#64748b",
                                      }}
                                    >
                                      {" "}
                                      
                                      <Clock size={12} /> 08:00 - 17:00
                                    </div>
                                  )
                                ) : (
                                   <span
                                    style={{
                                      color: "#cbd5e1",
                                      fontWeight: 800,
                                    }}
                                  >
                                    -
                                  </span>
                                )}
                              </div>
                            </td>
                            {(() => {
                              const otMorningTime =
                                l.shiftTimes?.otMorning || "06:00 - 08:00";
                              const isOtMorningBlockedByLeave = l.leave?.active
                                ? isTimeOverlap(
                                    otMorningTime,
                                    l.leave.time || "08:00 - 17:00",
                                  )
                                : false;
                              const canTickOtMorning =
                                isEditingExisting &&
                                canEditWorker(l) &&
                                l.shifts?.normal &&
                                !isOtMorningBlockedByLeave;
                              return (
                                 <td
                                  style={{
                                    padding: "12px 10px",
                                    textAlign: "center",
                                  }}
                                >
                                  {" "}
                                  
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "6px",
                                    }}
                                  >
                                    {" "}
                                    
                                    <div
                                      onClick={() =>
                                        canTickOtMorning &&
                                        toggleShift(l.id, "otMorning")
                                      }
                                      title={
                                        isOtMorningBlockedByLeave
                                          ? "โอทีเช้าทับกับเวลาลา"
                                          : void 0
                                      }
                                      style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 4,
                                        border: `2px solid ${isOtMorningBlockedByLeave ? "#fca5a5" : "#f59e0b"}`,
                                        background: l.shifts?.otMorning
                                          ? "#f59e0b"
                                          : isOtMorningBlockedByLeave
                                            ? "#fef2f2"
                                            : "#fff",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: canTickOtMorning
                                          ? "pointer"
                                          : "not-allowed",
                                        opacity:
                                          canTickOtMorning ||
                                          l.shifts?.otMorning
                                            ? 1
                                            : 0.4,
                                      }}
                                    >
                                      {l.shifts?.otMorning && (
                                         <CheckCircle2
                                          size={12}
                                          color="#fff"
                                        />
                                      )}
                                    </div>
                                    {l.shifts?.otMorning ? (
                                      l.membership === "Internal" ? (
                                        renderTimeInput(
                                          l.id,
                                          "otMorning",
                                          otMorningTime,
                                        )
                                      ) : (
                                         <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            background: "#f8fafc",
                                            borderRadius: "8px",
                                            border: "1px solid #e2e8f0",
                                            padding: "2px 6px",
                                            fontSize: "0.75rem",
                                            fontWeight: 700,
                                            color: "#64748b",
                                          }}
                                        >
                                          {" "}
                                          
                                          <Clock size={12} /> 06:00 - 08:00
                                        </div>
                                      )
                                    ) : (
                                       <span
                                        style={{
                                          color: isOtMorningBlockedByLeave
                                            ? "#fca5a5"
                                            : "#cbd5e1",
                                          fontWeight: 800,
                                          fontSize: "0.65rem",
                                        }}
                                      >
                                        {isOtMorningBlockedByLeave ? "🚫" : "-"}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })()}
                            {(() => {
                              const isOtNoonBlockedByLeave = l.leave?.active
                                ? isTimeOverlap(
                                    "12:00 - 13:00",
                                    l.leave.time || "08:00 - 17:00",
                                  )
                                : false;
                              const canTickOtNoon =
                                isEditingExisting &&
                                canEditWorker(l) &&
                                l.shifts?.normal &&
                                !isOtNoonBlockedByLeave;
                              return (
                                 <td
                                  style={{
                                    padding: "12px 10px",
                                    textAlign: "center",
                                  }}
                                >
                                  {" "}
                                  
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "6px",
                                    }}
                                  >
                                    {" "}
                                    
                                    <div
                                      onClick={() =>
                                        canTickOtNoon &&
                                        toggleShift(l.id, "otNoon")
                                      }
                                      title={
                                        isOtNoonBlockedByLeave
                                          ? "โอทีเที่ยงทับกับเวลาลา"
                                          : void 0
                                      }
                                      style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 4,
                                        border: `2px solid ${isOtNoonBlockedByLeave ? "#fca5a5" : "#f59e0b"}`,
                                        background: l.shifts?.otNoon
                                          ? "#f59e0b"
                                          : isOtNoonBlockedByLeave
                                            ? "#fef2f2"
                                            : "#fff",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: canTickOtNoon
                                          ? "pointer"
                                          : "not-allowed",
                                        opacity:
                                          canTickOtNoon || l.shifts?.otNoon
                                            ? 1
                                            : 0.4,
                                      }}
                                    >
                                      {l.shifts?.otNoon && (
                                         <CheckCircle2
                                          size={12}
                                          color="#fff"
                                        />
                                      )}
                                    </div>
                                    {l.shifts?.otNoon ? (
                                       <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          background: "#f8fafc",
                                          borderRadius: "8px",
                                          border: "1px solid #e2e8f0",
                                          padding: "2px 6px",
                                          fontSize: "0.75rem",
                                          fontWeight: 700,
                                          color: "#64748b",
                                        }}
                                      >
                                        {" "}
                                        
                                        <Clock size={12} /> 12:00 - 13:00
                                      </div>
                                    ) : (
                                       <span
                                        style={{
                                          color: isOtNoonBlockedByLeave
                                            ? "#fca5a5"
                                            : "#cbd5e1",
                                          fontWeight: 800,
                                          fontSize: "0.65rem",
                                        }}
                                      >
                                        {isOtNoonBlockedByLeave ? "🚫" : "-"}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })()}
                            {(() => {
                              const otEveningTime =
                                l.shiftTimes?.otEvening || "18:00 - 21:00";
                              const isOtEveningBlockedByLeave = l.leave?.active
                                ? isTimeOverlap(
                                    otEveningTime,
                                    l.leave.time || "08:00 - 17:00",
                                  )
                                : false;
                              const canTickOtEvening =
                                isEditingExisting &&
                                canEditWorker(l) &&
                                l.shifts?.normal &&
                                !isOtEveningBlockedByLeave;
                              return (
                                 <td
                                  style={{
                                    padding: "12px 10px",
                                    textAlign: "center",
                                  }}
                                >
                                  {" "}
                                  
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "6px",
                                    }}
                                  >
                                    {" "}
                                    
                                    <div
                                      onClick={() =>
                                        canTickOtEvening &&
                                        toggleShift(l.id, "otEvening")
                                      }
                                      title={
                                        isOtEveningBlockedByLeave
                                          ? "โอทีเย็นทับกับเวลาลา"
                                          : void 0
                                      }
                                      style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 4,
                                        border: `2px solid ${isOtEveningBlockedByLeave ? "#fca5a5" : "#f59e0b"}`,
                                        background: l.shifts?.otEvening
                                          ? "#f59e0b"
                                          : isOtEveningBlockedByLeave
                                            ? "#fef2f2"
                                            : "#fff",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: canTickOtEvening
                                          ? "pointer"
                                          : "not-allowed",
                                        opacity:
                                          canTickOtEvening ||
                                          l.shifts?.otEvening
                                            ? 1
                                            : 0.4,
                                      }}
                                    >
                                      {l.shifts?.otEvening && (
                                         <CheckCircle2
                                          size={12}
                                          color="#fff"
                                        />
                                      )}
                                    </div>
                                    {l.shifts?.otEvening ? (
                                      l.membership === "Internal" ? (
                                        renderTimeInput(
                                          l.id,
                                          "otEvening",
                                          otEveningTime,
                                        )
                                      ) : (
                                         <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            background: "#f8fafc",
                                            borderRadius: "8px",
                                            border: "1px solid #e2e8f0",
                                            padding: "2px 6px",
                                            fontSize: "0.75rem",
                                            fontWeight: 700,
                                            color: "#64748b",
                                          }}
                                        >
                                          {" "}
                                          
                                          <Clock size={12} /> 18:00 - 21:00
                                        </div>
                                      )
                                    ) : (
                                       <span
                                        style={{
                                          color: isOtEveningBlockedByLeave
                                            ? "#fca5a5"
                                            : "#cbd5e1",
                                          fontWeight: 800,
                                          fontSize: "0.65rem",
                                        }}
                                      >
                                        {isOtEveningBlockedByLeave ? "🚫" : "-"}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })()}{" "}
                            
                            <td
                              style={{
                                padding: "12px 16px",
                              }}
                            >
                              {" "}
                              
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                {" "}
                                
                                <div
                                  onClick={() => {
                                    if (!isEditingExisting || !canEditWorker(l)) return;
                                    setLabor((prev) =>
                                      prev.map((item) => {
                                        if (item.id === l.id) {
                                          const leaveActive =
                                            !item.leave?.active;
                                          let updatedTimes = item.shiftTimes
                                            ? {
                                                ...item.shiftTimes,
                                              }
                                            : {
                                                day: "08:00 - 17:00",
                                              };
                                          let shiftsObj = item.shifts
                                            ? {
                                                ...item.shifts,
                                              }
                                            : {
                                                normal: false,
                                                otMorning: false,
                                                otNoon: false,
                                                otEvening: false,
                                              };
                                          const leaveTime =
                                            item.leave?.time || "08:00 - 17:00";
                                          if (leaveActive) {
                                            if (leaveTime === "08:00 - 12:00") {
                                              if (
                                                updatedTimes.day ===
                                                  "08:00 - 17:00" &&
                                                shiftsObj.normal
                                              )
                                                updatedTimes.day =
                                                  "13:00 - 17:00";
                                            } else if (
                                              leaveTime === "13:00 - 17:00"
                                            ) {
                                              if (
                                                updatedTimes.day ===
                                                  "08:00 - 17:00" &&
                                                shiftsObj.normal
                                              )
                                                updatedTimes.day =
                                                  "08:00 - 12:00";
                                            }
                                            const regTime =
                                              updatedTimes.day ||
                                              "08:00 - 17:00";
                                            if (
                                              shiftsObj.normal &&
                                              isTimeOverlap(leaveTime, regTime)
                                            ) {
                                              shiftsObj.normal = false;
                                              shiftsObj.otMorning = false;
                                              shiftsObj.otNoon = false;
                                              shiftsObj.otEvening = false;
                                            }
                                          }
                                          return {
                                            ...item,
                                            shifts: shiftsObj,
                                            shiftTimes: updatedTimes,
                                            leave: {
                                              active: leaveActive,
                                              time: leaveTime,
                                              medCertFileUrl:
                                                item.leave?.medCertFileUrl ||
                                                "",
                                            },
                                          };
                                        }
                                        return item;
                                      }),
                                    );
                                  }}
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 4,
                                    border: "2px solid #ef4444",
                                    background: l.leave?.active
                                      ? "#ef4444"
                                      : "#fff",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: (isEditingExisting && canEditWorker(l))
                                      ? "pointer"
                                      : "default",
                                    opacity: (isEditingExisting && canEditWorker(l)) ? 1 : 0.6,
                                  }}
                                >
                                  {l.leave?.active && (
                                     <CheckCircle2
                                      size={12}
                                      color="#fff"
                                    />
                                  )}
                                </div>
                                {l.leave?.active ? (
                                   <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                    }}
                                  >
                                    {renderLeaveTimeInput(
                                      l.id,
                                      l.leave?.time || "08:00 - 17:00",
                                    )}{" "}
                                    
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                      }}
                                    >
                                      {l.leave?.medCertFileUrl ? (
                                         <Fragment>
                                          {" "}
                                          
                                          <a
                                            href={l.leave.medCertFileUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              width: "24px",
                                              height: "24px",
                                              borderRadius: "6px",
                                              background: "#eff6ff",
                                              color: "#2563eb",
                                              transition: "all 0.2s",
                                            }}
                                            title="ดูใบรับรองแพทย์"
                                          >
                                            {" "}
                                            
                                            <Eye size={12} />
                                          </a>
                                          {(isEditingExisting && canEditWorker(l)) && (
                                             <button
                                              onClick={() =>
                                                handleRemoveLeaveCert(l.id)
                                              }
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                width: "24px",
                                                height: "24px",
                                                borderRadius: "6px",
                                                background: "#fef2f2",
                                                color: "#ef4444",
                                                border: "none",
                                                cursor: "pointer",
                                                transition: "all 0.2s",
                                                padding: 0,
                                              }}
                                              title="ลบรูปแนบ"
                                            >
                                              {" "}
                                              
                                              <Trash2 size={12} />
                                            </button>
                                          )}
                                        </Fragment>
                                      ) : (isEditingExisting && canEditWorker(l)) ? (
                                        uploadingLeaveCertId === l.id ? ( 
                                          
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              width: "24px",
                                              height: "24px",
                                              borderRadius: "6px",
                                              background: "#fef3c7",
                                            }}
                                            title="กำลังอัปโหลด..."
                                          >
                                            {" "}
                                            
                                            <svg
                                              width="12"
                                              height="12"
                                              viewBox="0 0 24 24"
                                              style={{
                                                animation:
                                                  "spin 0.8s linear infinite",
                                              }}
                                            >
                                              {" "}
                                              
                                              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>{" "}
                                              
                                              <circle
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="#f59e0b"
                                                strokeWidth="3"
                                                fill="none"
                                                strokeDasharray="31.4"
                                                strokeDashoffset="10"
                                              />
                                            </svg>
                                          </div>
                                        ) : (
                                           <label
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              width: "24px",
                                              height: "24px",
                                              borderRadius: "6px",
                                              background: "#f1f5f9",
                                              color: "#64748b",
                                              cursor: "pointer",
                                              transition: "all 0.2s",
                                            }}
                                            title="แนบใบรับรองแพทย์/หลักฐาน"
                                          >
                                            {" "}
                                            
                                            <Paperclip size={12} /> 
                                            <input
                                              type="file"
                                              accept="image/*"
                                              style={{
                                                display: "none",
                                              }}
                                              onChange={(e) =>
                                                handleUploadLeaveCert(
                                                  l.id,
                                                  e.target.files?.[0] || undefined,
                                                )
                                              }
                                            />
                                          </label>
                                        )
                                      ) : (
                                         <span
                                          style={{
                                            color: "#cbd5e1",
                                            fontSize: "0.7rem",
                                          }}
                                        >
                                          ไม่มีหลักฐาน
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                   <span
                                    style={{
                                      color: "#cbd5e1",
                                      fontWeight: 800,
                                    }}
                                  >
                                    -
                                  </span>
                                )}
                              </div>
                            </td>{" "}
                            
                            <td
                              style={{
                                padding: "12px 10px",
                                textAlign: "center",
                              }}
                            >
                              {(isEditingExisting && canEditWorker(l)) ? (
                                 <button
                                  onClick={() =>
                                    setLabor(
                                      labor.filter((item) => item.id !== l.id),
                                    )
                                  }
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#ef4444",
                                    transition: "all 0.2s",
                                    padding: "4px",
                                  }}
                                >
                                  {" "}
                                  
                                  <Trash2 size={16} />
                                </button>
                              ) : (
                                 <span
                                  style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 800,
                                    color: "#94a3b8",
                                  }}
                                >
                                  {!canEditWorker(l) ? "สังกัดอื่น" : "ล็อกแล้ว"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                )}
                {isMobile && (
                  displayLabor.length === 0 ? (
                    <div style={{padding:"3rem", textAlign:"center", color:"#94a3b8", fontSize:"0.9rem", fontWeight:700}}>
                      <Users size={32} color="#cbd5e1" style={{marginBottom:"10px"}} />
                      {isTaskFinished ? (
                        <Fragment>
                          <div style={{color:"#0f172a", fontSize:"1rem", marginBottom:"4px"}}>ใบงานนี้ดำเนินการเสร็จสมบูรณ์ 100% แล้ว</div>
                          <div style={{fontSize:"0.78rem", color:"#64748b", fontWeight:600}}>(ไม่มีการบันทึกรายงานข้อมูลแรงงานสำหรับวันที่เลือก)</div>
                        </Fragment>
                      ) : (
                        <div>ยังไม่มีข้อมูลแรงงาน (กรุณากดปุ่มเพิ่มคนงานด้านบน)</div>
                      )}
                    </div>
                  ) : (
                    <div style={{display:"flex", flexDirection:"column", gap:"8px"}}>
                      {displayLabor.map((l) => {
                        const isExpanded = expandedLaborCards.has(l.id);
                        const initial = (l.staffName || l.affiliation || "?")[0].toUpperCase();
                        const isInternal = l.membership === "Internal";
                        const otMorningTime = l.shiftTimes?.otMorning || "06:00 - 08:00";
                        const otNoonTime = l.shiftTimes?.otNoon || "12:00 - 13:00";
                        const otEveningTime = l.shiftTimes?.otEvening || "18:00 - 20:00";
                        const leaveTime = l.leave?.time || "08:00 - 17:00";
                        const isOtMorningBlocked = l.leave?.active ? isTimeOverlap(otMorningTime, leaveTime) : false;
                        const isOtNoonBlocked = l.leave?.active ? isTimeOverlap(otNoonTime, leaveTime) : false;
                        const isOtEveningBlocked = l.leave?.active ? isTimeOverlap(otEveningTime, leaveTime) : false;
                        return (
                          <div key={l.id} style={{borderRadius:"12px", border:"1px solid #e2e8f0", background:"#fff", overflow:"hidden"}}>
                            <div onClick={() => toggleLaborCard(l.id)} style={{display:"flex", alignItems:"center", gap:"8px", padding:"10px 12px", cursor:"pointer"}}>
                              <div style={{width:36, height:36, borderRadius:"50%", background: isInternal ? "#eff6ff" : "#f0fdf4", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                                <span style={{fontSize:"0.9rem", fontWeight:800, color: isInternal ? "#2563eb" : "#059669"}}>{initial}</span>
                              </div>
                              <div style={{flex:1, minWidth:0}}>
                                <div style={{fontSize:"0.82rem", fontWeight:800, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{l.staffName || l.affiliation}</div>
                                <div style={{fontSize:"0.68rem", color:"#64748b", fontWeight:700}}>{l.employeeId ? `#${l.employeeId}` : (isInternal ? "Internal" : "Subco")}</div>
                              </div>
                              <div style={{display:"flex", gap:"3px", alignItems:"center"}}>
                                <div style={{width:7, height:7, borderRadius:"50%", background: l.shifts?.normal ? "#2563eb" : "#e2e8f0"}} title="ปกติ" />
                                <div style={{width:7, height:7, borderRadius:"50%", background: l.shifts?.otMorning ? "#f59e0b" : "#e2e8f0"}} title="OT เช้า" />
                                <div style={{width:7, height:7, borderRadius:"50%", background: l.shifts?.otNoon ? "#f59e0b" : "#e2e8f0"}} title="OT เที่ยง" />
                                <div style={{width:7, height:7, borderRadius:"50%", background: l.shifts?.otEvening ? "#f59e0b" : "#e2e8f0"}} title="OT เย็น" />
                                <div style={{width:7, height:7, borderRadius:"50%", background: l.leave?.active ? "#ef4444" : "#e2e8f0"}} title="ลา" />
                              </div>
                              {isExpanded ? <ChevronUp size={16} color="#94a3b8" style={{flexShrink:0}} /> : <ChevronDown size={16} color="#94a3b8" style={{flexShrink:0}} />}
                              {(isEditingExisting && canEditWorker(l)) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setLabor(labor.filter((item) => item.id !== l.id)); }}
                                  style={{background:"none", border:"none", cursor:"pointer", color:"#ef4444", padding:"4px", flexShrink:0, display:"flex", alignItems:"center"}}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                            {isExpanded && (
                              <div style={{borderTop:"1px solid #e2e8f0", padding:"10px 12px", display:"flex", flexDirection:"column", gap:"8px"}}>
                                <div style={{display:"flex", alignItems:"center", gap:"8px"}}>
                                  <div style={{fontSize:"0.72rem", fontWeight:800, color:"#2563eb", width:62, flexShrink:0}}>ปกติ</div>
                                  <div onClick={() => isEditingExisting && canEditWorker(l) && toggleShift(l.id, "normal")} style={{width:18, height:18, borderRadius:4, border:"2px solid #2563eb", background: l.shifts?.normal ? "#2563eb" : "#fff", display:"flex", alignItems:"center", justifyContent:"center", cursor:(isEditingExisting && canEditWorker(l)) ? "pointer" : "default", flexShrink:0}}>
                                    {l.shifts?.normal && <CheckCircle2 size={12} color="#fff" />}
                                  </div>
                                  {l.shifts?.normal ? (
                                    isInternal ? renderTimeInput(l.id, "normal", l.shiftTimes?.day || "08:00 - 17:00") : (
                                      <div style={{display:"flex", alignItems:"center", gap:"4px", background:"#f8fafc", borderRadius:"8px", border:"1px solid #e2e8f0", padding:"2px 6px", fontSize:"0.75rem", fontWeight:700, color:"#64748b"}}>
                                        <Clock size={12} /> 08:00 - 17:00
                                      </div>
                                    )
                                  ) : <span style={{color:"#cbd5e1", fontWeight:800, fontSize:"0.8rem"}}>-</span>}
                                </div>
                                <div style={{display:"flex", alignItems:"center", gap:"8px"}}>
                                  <div style={{fontSize:"0.72rem", fontWeight:800, color:"#f59e0b", width:62, flexShrink:0}}>OT เช้า</div>
                                  <div onClick={() => { const c = isEditingExisting && canEditWorker(l) && !!l.shifts?.normal && !isOtMorningBlocked; if (c) toggleShift(l.id, "otMorning"); }} title={isOtMorningBlocked ? "โอทีเช้าทับกับเวลาลา" : undefined} style={{width:18, height:18, borderRadius:4, border:`2px solid ${isOtMorningBlocked ? "#fca5a5" : "#f59e0b"}`, background: l.shifts?.otMorning ? "#f59e0b" : isOtMorningBlocked ? "#fef2f2" : "#fff", display:"flex", alignItems:"center", justifyContent:"center", cursor:(isEditingExisting && canEditWorker(l) && !!l.shifts?.normal && !isOtMorningBlocked) ? "pointer" : "not-allowed", opacity:(isEditingExisting && canEditWorker(l) && !!l.shifts?.normal && !isOtMorningBlocked) || l.shifts?.otMorning ? 1 : 0.4, flexShrink:0}}>
                                    {l.shifts?.otMorning && <CheckCircle2 size={12} color="#fff" />}
                                  </div>
                                  {l.shifts?.otMorning ? (
                                    isInternal ? renderTimeInput(l.id, "otMorning", otMorningTime) : (
                                      <div style={{display:"flex", alignItems:"center", gap:"4px", background:"#f8fafc", borderRadius:"8px", border:"1px solid #e2e8f0", padding:"2px 6px", fontSize:"0.75rem", fontWeight:700, color:"#64748b"}}>
                                        <Clock size={12} /> {otMorningTime}
                                      </div>
                                    )
                                  ) : <span style={{color:"#cbd5e1", fontWeight:800, fontSize:"0.8rem"}}>-</span>}
                                </div>
                                <div style={{display:"flex", alignItems:"center", gap:"8px"}}>
                                  <div style={{fontSize:"0.72rem", fontWeight:800, color:"#f59e0b", width:62, flexShrink:0}}>OT เที่ยง</div>
                                  <div onClick={() => { const c = isEditingExisting && canEditWorker(l) && !!l.shifts?.normal && !isOtNoonBlocked; if (c) toggleShift(l.id, "otNoon"); }} title={isOtNoonBlocked ? "โอทีเที่ยงทับกับเวลาลา" : undefined} style={{width:18, height:18, borderRadius:4, border:`2px solid ${isOtNoonBlocked ? "#fca5a5" : "#f59e0b"}`, background: l.shifts?.otNoon ? "#f59e0b" : isOtNoonBlocked ? "#fef2f2" : "#fff", display:"flex", alignItems:"center", justifyContent:"center", cursor:(isEditingExisting && canEditWorker(l) && !!l.shifts?.normal && !isOtNoonBlocked) ? "pointer" : "not-allowed", opacity:(isEditingExisting && canEditWorker(l) && !!l.shifts?.normal && !isOtNoonBlocked) || l.shifts?.otNoon ? 1 : 0.4, flexShrink:0}}>
                                    {l.shifts?.otNoon && <CheckCircle2 size={12} color="#fff" />}
                                  </div>
                                  {l.shifts?.otNoon ? (
                                    isInternal ? renderTimeInput(l.id, "otNoon", otNoonTime) : (
                                      <div style={{display:"flex", alignItems:"center", gap:"4px", background:"#f8fafc", borderRadius:"8px", border:"1px solid #e2e8f0", padding:"2px 6px", fontSize:"0.75rem", fontWeight:700, color:"#64748b"}}>
                                        <Clock size={12} /> {otNoonTime}
                                      </div>
                                    )
                                  ) : <span style={{color:"#cbd5e1", fontWeight:800, fontSize:"0.8rem"}}>-</span>}
                                </div>
                                <div style={{display:"flex", alignItems:"center", gap:"8px"}}>
                                  <div style={{fontSize:"0.72rem", fontWeight:800, color:"#f59e0b", width:62, flexShrink:0}}>OT เย็น</div>
                                  <div onClick={() => { const c = isEditingExisting && canEditWorker(l) && !!l.shifts?.normal && !isOtEveningBlocked; if (c) toggleShift(l.id, "otEvening"); }} title={isOtEveningBlocked ? "โอทีเย็นทับกับเวลาลา" : undefined} style={{width:18, height:18, borderRadius:4, border:`2px solid ${isOtEveningBlocked ? "#fca5a5" : "#f59e0b"}`, background: l.shifts?.otEvening ? "#f59e0b" : isOtEveningBlocked ? "#fef2f2" : "#fff", display:"flex", alignItems:"center", justifyContent:"center", cursor:(isEditingExisting && canEditWorker(l) && !!l.shifts?.normal && !isOtEveningBlocked) ? "pointer" : "not-allowed", opacity:(isEditingExisting && canEditWorker(l) && !!l.shifts?.normal && !isOtEveningBlocked) || l.shifts?.otEvening ? 1 : 0.4, flexShrink:0}}>
                                    {l.shifts?.otEvening && <CheckCircle2 size={12} color="#fff" />}
                                  </div>
                                  {l.shifts?.otEvening ? (
                                    isInternal ? renderTimeInput(l.id, "otEvening", otEveningTime) : (
                                      <div style={{display:"flex", alignItems:"center", gap:"4px", background:"#f8fafc", borderRadius:"8px", border:"1px solid #e2e8f0", padding:"2px 6px", fontSize:"0.75rem", fontWeight:700, color:"#64748b"}}>
                                        <Clock size={12} /> {otEveningTime}
                                      </div>
                                    )
                                  ) : <span style={{color:"#cbd5e1", fontWeight:800, fontSize:"0.8rem"}}>-</span>}
                                </div>
                                <div style={{display:"flex", alignItems:"flex-start", gap:"8px"}}>
                                  <div style={{fontSize:"0.72rem", fontWeight:800, color:"#ef4444", width:62, flexShrink:0, paddingTop:"2px"}}>ลา</div>
                                  <div style={{display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap"}}>
                                    <div
                                      onClick={() => {
                                        if (!isEditingExisting || !canEditWorker(l)) return;
                                        setLabor((prev) => prev.map((item) => {
                                          if (item.id === l.id) {
                                            const leaveActive = !item.leave?.active;
                                            const updatedTimes = item.shiftTimes ? {...item.shiftTimes} : {day: "08:00 - 17:00"};
                                            const shiftsObj = item.shifts ? {...item.shifts} : {normal: false, otMorning: false, otNoon: false, otEvening: false};
                                            const lt = item.leave?.time || "08:00 - 17:00";
                                            if (leaveActive) {
                                              if (lt === "08:00 - 12:00") { if (updatedTimes.day === "08:00 - 17:00" && shiftsObj.normal) updatedTimes.day = "13:00 - 17:00"; }
                                              else if (lt === "13:00 - 17:00") { if (updatedTimes.day === "08:00 - 17:00" && shiftsObj.normal) updatedTimes.day = "08:00 - 12:00"; }
                                              const rt = updatedTimes.day || "08:00 - 17:00";
                                              if (shiftsObj.normal && isTimeOverlap(lt, rt)) { shiftsObj.normal = false; shiftsObj.otMorning = false; shiftsObj.otNoon = false; shiftsObj.otEvening = false; }
                                            }
                                            return {...item, shifts: shiftsObj, shiftTimes: updatedTimes, leave: {active: leaveActive, time: lt, medCertFileUrl: item.leave?.medCertFileUrl || ""}};
                                          }
                                          return item;
                                        }));
                                      }}
                                      style={{width:18, height:18, borderRadius:4, border:"2px solid #ef4444", background: l.leave?.active ? "#ef4444" : "#fff", display:"flex", alignItems:"center", justifyContent:"center", cursor:(isEditingExisting && canEditWorker(l)) ? "pointer" : "default", opacity:(isEditingExisting && canEditWorker(l)) ? 1 : 0.6, flexShrink:0}}
                                    >
                                      {l.leave?.active && <CheckCircle2 size={12} color="#fff" />}
                                    </div>
                                    {l.leave?.active ? (
                                      <div style={{display:"flex", alignItems:"center", gap:"4px", flexWrap:"wrap"}}>
                                        {renderLeaveTimeInput(l.id, l.leave?.time || "08:00 - 17:00")}
                                        <div style={{display:"flex", alignItems:"center", gap:"4px"}}>
                                          {l.leave?.medCertFileUrl ? (
                                            <Fragment>
                                              <a href={l.leave.medCertFileUrl} target="_blank" rel="noreferrer" style={{display:"flex", alignItems:"center", justifyContent:"center", width:"24px", height:"24px", borderRadius:"6px", background:"#eff6ff", color:"#2563eb"}} title="ดูใบรับรองแพทย์">
                                                <Eye size={12} />
                                              </a>
                                              {(isEditingExisting && canEditWorker(l)) && (
                                                <button onClick={() => handleRemoveLeaveCert(l.id)} style={{display:"flex", alignItems:"center", justifyContent:"center", width:"24px", height:"24px", borderRadius:"6px", background:"#fef2f2", color:"#ef4444", border:"none", cursor:"pointer", padding:0}} title="ลบรูปแนบ">
                                                  <Trash2 size={12} />
                                                </button>
                                              )}
                                            </Fragment>
                                          ) : (isEditingExisting && canEditWorker(l)) ? (
                                            uploadingLeaveCertId === l.id ? (
                                              <div style={{display:"flex", alignItems:"center", justifyContent:"center", width:"24px", height:"24px", borderRadius:"6px", background:"#fef3c7"}} title="กำลังอัปโหลด...">
                                                <svg width="12" height="12" viewBox="0 0 24 24" style={{animation:"spin 0.8s linear infinite"}}>
                                                  <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                                                  <circle cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="3" fill="none" strokeDasharray="31.4" strokeDashoffset="10" />
                                                </svg>
                                              </div>
                                            ) : (
                                              <label style={{display:"flex", alignItems:"center", justifyContent:"center", width:"24px", height:"24px", borderRadius:"6px", background:"#f1f5f9", color:"#64748b", cursor:"pointer"}} title="แนบใบรับรองแพทย์/หลักฐาน">
                                                <Paperclip size={12} />
                                                <input type="file" accept="image/*" style={{display:"none"}} onChange={(e) => handleUploadLeaveCert(l.id, e.target.files?.[0] || undefined)} />
                                              </label>
                                            )
                                          ) : (
                                            <span style={{color:"#cbd5e1", fontSize:"0.7rem"}}>ไม่มีหลักฐาน</span>
                                          )}
                                        </div>
                                      </div>
                                    ) : <span style={{color:"#cbd5e1", fontWeight:800, fontSize:"0.8rem"}}>-</span>}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </section>{" "}
              
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: gridCols(isMobile, "minmax(280px, 1.2fr) 2.8fr"),
                  gap: "2.5rem",
                }}
              >
                {" "}
                
                <div>
                  {" "}
                  
                  <h3
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 900,
                      color: "#0f172a",
                      margin: "0 0 1.25rem 0",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {" "}
                    
                    <CheckCircle2 size={20} color="#10b981" /> ความคืบหน้า
                  </h3>{" "}
                  
                  <div
                    style={{
                      padding: "1.5rem",
                      background: "#f8fafc",
                      borderRadius: "20px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {" "}
                    
                    {selectedTaskInfo?.task?.isHelper ? (
                      <div style={{ textAlign: "center", padding: "1rem 0", color: "#475569", fontWeight: 800, fontSize: "0.88rem" }}>
                        งานช่วย: ความคืบหน้าถูกล็อกที่ {selectedTaskInfo?.task?.dailyProgress || 0}% (กำหนดโดย Site หลัก)
                      </div>
                    ) : (
                      <Fragment>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "16px",
                            marginBottom: "1.5rem",
                          }}
                        >
                          {" "}
                          
                          <div
                            style={{
                              flex: 1,
                              position: "relative",
                              opacity: isProgressNotePhotosEditable ? 1 : 0.6,
                              pointerEvents: isProgressNotePhotosEditable
                                ? "auto"
                                : "none",
                              transition: "all 0.3s",
                            }}
                          >
                            {" "}
                            
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={progress}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const allowedMin = progressBounds.min > 0 ? progressBounds.min + 1 : 0;
                                setProgress(
                                  Math.min(
                                    progressBounds.max,
                                    Math.max(allowedMin, val),
                                  ),
                                );
                              }}
                              style={{
                                width: "100%",
                                height: "10px",
                                borderRadius: "6px",
                                appearance: "none",
                                background: `linear-gradient(to right, #475569 0%, #475569 ${progressBounds.min}%, #3b82f6 ${progressBounds.min}%, #3b82f6 ${progress}%, #e2e8f0 ${progress}%, #e2e8f0 100%)`,
                                cursor: "pointer",
                                outline: "none",
                                transition: "all 0.2s",
                              }}
                            />
                          </div>{" "}
                          
                          <div
                            style={{
                              position: "relative",
                              width: "100px",
                            }}
                          >
                            {" "}
                            
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={progress}
                              disabled={!isProgressNotePhotosEditable}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (isNaN(val)) {
                                  setProgress(0);
                                } else {
                                  setProgress(Math.min(100, Math.max(0, val)));
                                }
                              }}
                              onBlur={() => {
                                setProgress(
                                  Math.min(
                                    progressBounds.max,
                                    Math.max(progressBounds.min, progress),
                                  ),
                                );
                              }}
                              style={{
                                width: "100%",
                                padding: "8px 30px 8px 12px",
                                borderRadius: "10px",
                                border: "1px solid #3b82f6",
                                fontSize: "1rem",
                                fontWeight: 900,
                                color: "#1e40af",
                                textAlign: "center",
                                outline: "none",
                                boxShadow: "0 2px 4px rgba(59, 130, 246, 0.1)",
                              }}
                            />{" "}
                            
                            <span
                              style={{
                                position: "absolute",
                                right: "10px",
                                top: "51%",
                                transform: "translateY(-50%)",
                                fontSize: "0.8rem",
                                fontWeight: 800,
                                color: "#3b82f6",
                              }}
                            >
                              %
                            </span>
                          </div>
                        </div>{" "}
                        
                        <div
                          style={{
                            marginTop: "1rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          {" "}
                          
                          <div
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              color:
                                (progressBounds.min > 0 ? progress <= progressBounds.min : progress < progressBounds.min) ||
                                progress > progressBounds.max
                                  ? "#ef4444"
                                  : "#64748b",
                            }}
                          >
                            {(() => {
                              const hasDataOnDate =
                                selectedTaskInfo?.task.history?.some(
                                  (h) => h.revisionId === (selectedTaskInfo.task.currentRevision || 'rev00') && h.date?.split("T")[0] === reportDate,
                                );
                              if (hasDataOnDate && !isEditingExisting) {
                                return `* รายงานนี้ถูกบันทึกไว้แล้วที่ ${progress}%`;
                              }
                              if (
                                reportDate ===
                                 new Date()
                                  .toISOString()
                                  .split("T")[0]
                              ) {
                                return `* ความคืบหน้าปัจจุบันต้องระบุมากกว่า ${progressBounds.min}%`;
                              }
                              const rangeMin = progressBounds.min > 0 ? progressBounds.min + 1 : 0;
                              return `* สำหรับวันที่เลือก ต้องระบุระหว่าง ${rangeMin}% ถึง ${progressBounds.max}%`;
                            })()}
                          </div>
                          {isProgressNotePhotosEditable && progress > 0 && progressBounds.min === 0 && (
                             <button
                              onClick={() => setProgress(0)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                fontSize: "0.75rem",
                                fontWeight: 800,
                                cursor: "pointer",
                              }}
                            >
                              ล้างค่า
                            </button>
                          )}
                        </div>{" "}
                        
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                            marginTop: "1rem",
                            pointerEvents: isProgressNotePhotosEditable
                              ? "auto"
                              : "none",
                            opacity: isProgressNotePhotosEditable ? 1 : 0.6,
                          }}
                        >
                          {[0, 25, 50, 75, 100].map((v) => {
                            const isLocked =
                              (progressBounds.min > 0 ? v <= progressBounds.min : v < progressBounds.min) ||
                              v > progressBounds.max;
                            return (
                               <button
                                onClick={() => setProgress(v)}
                                disabled={isLocked}
                                style={{
                                  flex: 1,
                                  padding: "8px 0",
                                  borderRadius: "8px",
                                  border: "1px solid",
                                  borderColor:
                                    progress === v ? "#3b82f6" : "#e2e8f0",
                                  background:
                                    progress === v
                                      ? "#eff6ff"
                                      : isLocked
                                        ? "#f1f5f9"
                                        : "#fff",
                                  color:
                                    progress === v
                                      ? "#2563eb"
                                      : isLocked
                                        ? "#94a3b8"
                                        : "#64748b",
                                  fontSize: "0.75rem",
                                  fontWeight: 800,
                                  cursor: isLocked ? "not-allowed" : "pointer",
                                  transition: "all 0.2s",
                                  opacity: isLocked ? 0.6 : 1,
                                  textDecoration: isLocked
                                    ? "line-through"
                                    : "none",
                                }}
                                key={v}
                              >
                                {v === 0
                                  ? "ล้าง"
                                  : v === 100
                                    ? "เสร็จสิ้น"
                                    : `${v}%`}
                              </button>
                            );
                          })}
                        </div>
                      </Fragment>
                    )}
                  </div>
                  {progress === 100 &&
                    reportDate !==
                       new Date()
                        .toISOString()
                        .split("T")[0] && (
                       <div
                        style={{
                          marginTop: "1rem",
                          padding: "12px",
                          background: "#fff7ed",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          color: "#c2410c",
                          fontWeight: 700,
                          display: "flex",
                          gap: "8px",
                          border: "1px solid #ffedd5",
                        }}
                      >
                        {" "}
                        
                        <AlertCircle size={14} /> 
                        <span>
                          ข้อควรระวัง: การลงปิดงาน (100%) ย้อนหลัง
                          ควรทำเฉพาะในกรณีที่ไม่มีรายงานของวันถัดไป
                        </span>
                      </div>
                    )}
                  {progress === 100 &&
                    reportDate ===
                       new Date()
                        .toISOString()
                        .split("T")[0] && (
                       <div
                        style={{
                          marginTop: "1rem",
                          padding: "12px",
                          background: "#eff6ff",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          color: "#1e40af",
                          fontWeight: 700,
                          display: "flex",
                          gap: "8px",
                        }}
                      >
                        {" "}
                        
                        <Info size={14} /> 
                        <span>
                          ยืนยันที่ 100% ระบบจะใช้รูปภาพเป็นรูป "หลังซ่อม"
                        </span>
                      </div>
                    )}
                </div>{" "}
                
                <div>
                  {" "}
                  
                  <h3
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 900,
                      color: "#0f172a",
                      margin: "0 0 1rem 0",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {" "}
                    
                    <Camera size={20} color="#3b82f6" /> รูปถ่ายรายงานผล
                    {isShowingMainPhotosFallback && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "#2563eb",
                          fontWeight: 700,
                          marginLeft: "auto",
                          background: "#eff6ff",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          border: "1px solid #bfdbfe",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        แสดงรูปจากใบงานหลักเพื่ออ้างอิง
                      </span>
                    )}
                  </h3>{" "}
                  
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                      marginBottom: "1.25rem",
                    }}
                  >
                    {[
                      {
                        id: "site",
                        label: "รูปถ่ายหน้างาน",
                        required: selectedTaskInfo?.task?.isHelper ? 0 : 2,
                        current: displaySitePhotos.length,
                        isMinimum: !selectedTaskInfo?.task?.isHelper,
                        show: true,
                      },
                      {
                        id: "regular",
                        label: "กะปกติ",
                        required: selectedTaskInfo?.task?.isHelper ? 0 : (() => {
                          const normalLabor = referenceLabor.filter((l) => l.shifts?.normal);
                          if (normalLabor.length === 0) return 4;

                          const parseStartHour = (timeRange: string): number => {
                            if (!timeRange) return 8;
                            const parts = timeRange.split(" - ");
                            if (parts.length < 1) return 8;
                            const [h, m] = parts[0].split(":").map(Number);
                            if (isNaN(h)) return 8;
                            return h + (isNaN(m) ? 0 : m) / 60;
                          };
                          
                          const parseEndHour = (timeRange: string): number => {
                            if (!timeRange) return 17;
                            const parts = timeRange.split(" - ");
                            if (parts.length < 2) return 17;
                            const [h, m] = parts[1].split(":").map(Number);
                            if (isNaN(h)) return 17;
                            return h + (isNaN(m) ? 0 : m) / 60;
                          };

                          const minStartHour = normalLabor.reduce((min, l) => {
                            const startHour = parseStartHour(l.shiftTimes?.day || "08:00 - 17:00");
                            return Math.min(min, startHour);
                          }, 24);
                          
                          const maxEndHour = normalLabor.reduce((max, l) => {
                            const endHour = parseEndHour(l.shiftTimes?.day || "08:00 - 17:00");
                            return Math.max(max, endHour);
                          }, 0);
                          
                          if (minStartHour >= 13.0 || maxEndHour <= 12.0) {
                            return 2;
                          }
                          return 4;
                        })(),
                        current: displayRegularPhotos.length,
                        isMinimum: false,
                        show: displayLabor.some((l) => l.shifts?.normal) || (selectedTaskInfo?.task?.isHelper && displayRegularPhotos.length > 0),
                      },
                      {
                        id: "otMorning",
                        label: "OT เช้า",
                        required: selectedTaskInfo?.task?.isHelper ? 0 : 2,
                        current: displayOtMorningPhotos.length,
                        isMinimum: false,
                        show: displayLabor.some((l) => l.shifts?.otMorning) || (selectedTaskInfo?.task?.isHelper && displayOtMorningPhotos.length > 0),
                      },
                      {
                        id: "otNoon",
                        label: "OT เที่ยง",
                        required: selectedTaskInfo?.task?.isHelper ? 0 : 2,
                        current: displayOtNoonPhotos.length,
                        isMinimum: false,
                        show: displayLabor.some((l) => l.shifts?.otNoon) || (selectedTaskInfo?.task?.isHelper && displayOtNoonPhotos.length > 0),
                      },
                      {
                        id: "otEvening",
                        label: "OT เย็น",
                        required: selectedTaskInfo?.task?.isHelper ? 0 : 2,
                        current: displayOtEveningPhotos.length,
                        isMinimum: false,
                        show: displayLabor.some((l) => l.shifts?.otEvening) || (selectedTaskInfo?.task?.isHelper && displayOtEveningPhotos.length > 0),
                      },
                    ]
                      .filter((tab) => tab.show)
                      .map((tab) => {
                        const isComplete = selectedTaskInfo?.task?.isHelper ? true : (tab.current >= tab.required);
                        const isActive = activePhotoTab === tab.id;
                        return (
                           <button
                            onClick={() => setActivePhotoTab(tab.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              padding: "10px 12px",
                              borderRadius: "14px",
                              border: "2px solid",
                              borderColor: isActive
                                ? isComplete
                                  ? "#059669"
                                  : "#334155"
                                : isComplete
                                  ? "#10b981"
                                  : "#cbd5e1",
                              background: isActive
                                ? isComplete
                                  ? "#d1fae5"
                                  : "#f1f5f9"
                                : isComplete
                                  ? "#ecfdf5"
                                  : "#ffffff",
                              color: isComplete ? "#059669" : "#475569",
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
                              transform: isActive ? "scale(1.02)" : "scale(1)",
                              boxShadow: isActive
                                ? "0 4px 12px rgba(0,0,0,0.08)"
                                : "none",
                              minWidth: "135px",
                            }}
                            key={tab.id}
                          >
                            {" "}
                            
                            <span
                              style={{
                                flexShrink: 0,
                              }}
                            >
                              {isComplete ? (
                                 <CheckCircle2
                                  size={18}
                                  color="#059669"
                                />
                              ) : (
                                 <Camera
                                  size={18}
                                  color="#94a3b8"
                                />
                              )}
                            </span>{" "}
                            
                            <span
                              style={{
                                flex: 1,
                              }}
                            >
                              {" "}
                              
                              <span
                                style={{
                                  display: "block",
                                  fontSize: "0.82rem",
                                  fontWeight: 800,
                                  lineHeight: 1.2,
                                }}
                              >
                                {tab.label}
                              </span>{" "}
                              
                              <span
                                style={{
                                  display: "block",
                                  fontSize: "0.68rem",
                                  fontWeight: 700,
                                  color: isComplete ? "#059669" : "#94a3b8",
                                  marginTop: "2px",
                                }}
                              >
                                {selectedTaskInfo?.task?.isHelper ? (
                                  `อ้างอิงจากงานหลัก ${tab.current} รูป`
                                ) : (
                                  <React.Fragment>
                                    แนบแล้ว {tab.current}/{tab.required} รูป
                                    {tab.isMinimum ? " (ขั้นต่ำ)" : ""}
                                  </React.Fragment>
                                )}
                              </span>
                            </span>{" "}
                            
                            <ChevronRight
                              size={14}
                              style={{
                                opacity: 0.4,
                                flexShrink: 0,
                              }}
                            />
                          </button>
                        );
                      })}
                  </div>{" "}
                  
                  <div
                    style={{
                      background: "#f8fafc",
                      padding: "1.25rem",
                      borderRadius: "16px",
                      border: "1px solid #e2e8f0",
                      minHeight: "160px",
                    }}
                  >
                    {activePhotoTab === "site" && (
                       <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "12px",
                          alignItems: "flex-start",
                        }}
                      >
                        {displaySitePhotos.map((p: File | string | null, i: number) => (
                           <div
                            style={{
                              position: "relative",
                              width: 110,
                              height: 110,
                              borderRadius: 14,
                              overflow: "hidden",
                              border: "1px solid #e2e8f0",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                            }}
                            key={i}
                          >
                            {" "}
                            
                            <img
                              src={typeof p === "string" ? p : (p instanceof File ? URL.createObjectURL(p) : undefined)}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                cursor: "pointer",
                              }}
                              onClick={() => setZoomImage(typeof p === "string" ? p : (p instanceof File ? URL.createObjectURL(p) : null))}
                              alt=""
                            />
                            {isProgressNotePhotosEditable && !selectedTaskInfo?.task?.isHelper && (
                               <button
                                onClick={() => handleRemoveSlotPhoto("site", i)}
                                style={{
                                  position: "absolute",
                                  top: 5,
                                  right: 5,
                                  background: "rgba(239,68,68,0.9)",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: "6px",
                                  padding: "4px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {" "}
                                
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        ))}
                        {isProgressNotePhotosEditable && !selectedTaskInfo?.task?.isHelper && (
                           <label
                            style={{
                              width: 110,
                              height: 110,
                              border: "2px dashed #3b82f6",
                              borderRadius: 14,
                              background: "#eff6ff",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#3b82f6",
                              cursor: isUploading ? "not-allowed" : "pointer",
                              gap: "6px",
                              transition: "all 0.2s",
                              opacity: isUploading ? 0.6 : 1,
                            }}
                          >
                            {isUploading ? (
                               <Loader2
                                className="animate-spin"
                                size={22}
                              />
                            ) : (
                               <Camera size={22} />
                            )}{" "}
                            
                            <span
                              style={{
                                fontSize: "0.65rem",
                                fontWeight: 900,
                                textAlign: "center",
                              }}
                            >
                              {isUploading ? "กำลังอัป..." : "เพิ่มรูป"}
                            </span>{" "}
                            
                            <input
                              type="file"
                              accept="image/*"
                              style={{
                                display: "none",
                              }}
                              onChange={(e) =>
                                handleSlotPhotoUpload(
                                  "site",
                                  sitePhotos.length,
                                  e,
                                )
                              }
                              disabled={isUploading}
                            />
                          </label>
                        )}
                        {displaySitePhotos.length === 0 && (
                           <div
                            style={{
                              color: "#94a3b8",
                              fontSize: "0.8rem",
                              fontWeight: 700,
                              padding: "1rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            {" "}
                            
                            <AlertCircle size={14} color={isTaskFinished ? "#10b981" : "#ef4444"} />{" "}
                            {isTaskFinished ? (
                              <Fragment>
                                <span style={{ color: "#0f172a" }}>ใบงานนี้ดำเนินการเสร็จสมบูรณ์ 100% แล้ว</span>{" "}
                                <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>(ไม่มีการแนบรูปภาพหน้างานสำหรับวันที่เลือก)</span>
                              </Fragment>
                            ) : selectedTaskInfo?.task?.isHelper ? (
                              <span style={{ color: "#64748b" }}>ไม่มีการแนบรูปภาพหน้างาน (งานช่วย)</span>
                            ) : (
                              "ยังไม่มีรูปภาพหน้างาน — กรุณาแนบอย่างน้อย 2 รูป"
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {["regular", "otMorning", "otNoon", "otEvening"].map(
                      (shiftKey) => {
                        if (activePhotoTab !== shiftKey) return null;
                        const getShiftTime = (key: string) => {
                          const times = referenceLabor
                            .filter(
                              (l) => l.shifts?.[(key === "day" ? "normal" : key) as keyof ShiftConfig],
                            )
                            .map((l) => l.shiftTimes?.[key as keyof ShiftTimes])
                            .filter(Boolean);
                          return times[0] || "";
                        };
                        const parseStart = (range: string) =>
                          range?.split(" - ")[0] || "";
                        const parseEnd = (range: string) =>
                          range?.split(" - ")[1] || "";

                        const isSlotTimeAllowed = (slotIdx: number) => {
                          const todayStr = todayTH();
                          if (reportDate < todayStr) return true;
                          if (reportDate > todayStr) return false;

                          const now = new Date();
                          const currentHour = now.getHours();
                          const currentMin = now.getMinutes();

                          const hasReachedTime = (timeStr: string, defaultHour: number) => {
                            if (!timeStr) return currentHour >= defaultHour;
                            const [h, m] = timeStr.split(":").map(Number);
                            if (currentHour > h) return true;
                            if (currentHour === h) return currentMin >= m;
                            return false;
                          };

                          if (shiftKey === "regular") {
                            const dayRange = getShiftTime("day");
                            const startT = parseStart(dayRange);
                            const endT = parseEnd(dayRange);

                            const normalLabor = referenceLabor.filter((l) => l.shifts?.normal);
                            let requiredCount = 4;
                            let minStartHour = 8;
                            let maxEndHour = 17;
                            if (normalLabor.length > 0) {
                              const parseStartHour = (timeRange: string): number => {
                                if (!timeRange) return 8;
                                const parts = timeRange.split(" - ");
                                if (parts.length < 1) return 8;
                                const [h, m] = parts[0].split(":").map(Number);
                                if (isNaN(h)) return 8;
                                return h + (isNaN(m) ? 0 : m) / 60;
                              };
                              const parseEndHour = (timeRange: string): number => {
                                if (!timeRange) return 17;
                                const parts = timeRange.split(" - ");
                                if (parts.length < 2) return 17;
                                const [h, m] = parts[1].split(":").map(Number);
                                if (isNaN(h)) return 17;
                                return h + (isNaN(m) ? 0 : m) / 60;
                              };
                              minStartHour = normalLabor.reduce((min, l) => {
                                const startHour = parseStartHour(l.shiftTimes?.day || "08:00 - 17:00");
                                return Math.min(min, startHour);
                              }, 24);
                              maxEndHour = normalLabor.reduce((max, l) => {
                                const endHour = parseEndHour(l.shiftTimes?.day || "08:00 - 17:00");
                                return Math.max(max, endHour);
                              }, 0);
                              if (minStartHour >= 13.0 || maxEndHour <= 12.0) {
                                requiredCount = 2;
                              }
                            }

                            if (requiredCount === 2) {
                              if (minStartHour >= 13.0) {
                                if (slotIdx === 0) return hasReachedTime(startT, 13);
                                if (slotIdx === 1) return hasReachedTime(endT, 17);
                              } else {
                                if (slotIdx === 0) return hasReachedTime(startT, 8);
                                if (slotIdx === 1) return hasReachedTime(endT, 17);
                              }
                            } else {
                              if (slotIdx === 0) return hasReachedTime(startT, 8);
                              if (slotIdx === 1) return hasReachedTime("12:00", 12);
                              if (slotIdx === 2) return hasReachedTime("13:00", 13);
                              if (slotIdx === 3) return hasReachedTime(endT, 17);
                            }
                          } else {
                            const otRange = getShiftTime(shiftKey);
                            const startT = parseStart(otRange);
                            const endT = parseEnd(otRange);

                            if (slotIdx === 0) return hasReachedTime(startT, shiftKey === "otMorning" ? 6 : (shiftKey === "otNoon" ? 12 : 18));
                            if (slotIdx === 1) return hasReachedTime(endT, shiftKey === "otMorning" ? 8 : (shiftKey === "otNoon" ? 13 : 21));
                          }
                          return true;
                        };

                        let slotLabels;
                        if (shiftKey === "regular") {
                          const dayRange = getShiftTime("day");
                          const startT = parseStart(dayRange);
                          const endT = parseEnd(dayRange);

                          const normalLabor = labor.filter((l) => l.shifts?.normal);
                          let requiredCount = 4;
                          let minStartHour = 8;
                          let maxEndHour = 17;
                          if (normalLabor.length > 0) {
                            const parseStartHour = (timeRange: string): number => {
                              if (!timeRange) return 8;
                              const parts = timeRange.split(" - ");
                              if (parts.length < 1) return 8;
                              const [h, m] = parts[0].split(":").map(Number);
                              if (isNaN(h)) return 8;
                              return h + (isNaN(m) ? 0 : m) / 60;
                            };
                            const parseEndHour = (timeRange: string): number => {
                              if (!timeRange) return 17;
                              const parts = timeRange.split(" - ");
                              if (parts.length < 2) return 17;
                              const [h, m] = parts[1].split(":").map(Number);
                              if (isNaN(h)) return 17;
                              return h + (isNaN(m) ? 0 : m) / 60;
                            };
                            minStartHour = normalLabor.reduce((min, l) => {
                              const startHour = parseStartHour(l.shiftTimes?.day || "08:00 - 17:00");
                              return Math.min(min, startHour);
                            }, 24);
                            maxEndHour = normalLabor.reduce((max, l) => {
                              const endHour = parseEndHour(l.shiftTimes?.day || "08:00 - 17:00");
                              return Math.max(max, endHour);
                            }, 0);
                            if (minStartHour >= 13.0 || maxEndHour <= 12.0) {
                              requiredCount = 2;
                            }
                          }

                          if (requiredCount === 2) {
                            if (minStartHour >= 13.0) {
                              slotLabels = [
                                startT ? `เข้าบ่าย (${startT})` : "เข้าบ่าย",
                                endT ? `ออก (${endT})` : "ออก",
                              ];
                            } else {
                              slotLabels = [
                                startT ? `เช้า (${startT})` : "เช้า",
                                endT ? `ออก (${endT})` : "ออก",
                              ];
                            }
                          } else {
                            slotLabels = [
                              startT ? `เช้า (${startT})` : "เช้า",
                              "พักเที่ยง (12:00)",
                              "เข้าบ่าย (13:00)",
                              endT ? `ออก (${endT})` : "ออก",
                            ];
                          }
                        } else {
                          const otKey = shiftKey;
                          const otRange = getShiftTime(otKey);
                          const startT = parseStart(otRange);
                          const endT = parseEnd(otRange);
                          slotLabels = [
                            startT ? `เข้า (${startT})` : "เข้า",
                            endT ? `ออก (${endT})` : "ออก",
                          ];
                        }
                        const shiftPhotos = {
                          regular: displayRegularPhotos,
                          otMorning: displayOtMorningPhotos,
                          otNoon: displayOtNoonPhotos,
                          otEvening: displayOtEveningPhotos,
                        }[shiftKey as "regular" | "otMorning" | "otNoon" | "otEvening"] || [];
                        return (
                           <div
                            style={{
                              display: "flex",
                              gap: "16px",
                              flexWrap: "wrap",
                              alignItems: "flex-end",
                            }}
                            key={shiftKey}
                          >
                            {slotLabels.map((slotLabel, slotIdx) => {
                              const photoUrl = shiftPhotos[slotIdx];
                              return (
                                 <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                  key={slotIdx}
                                >
                                  {photoUrl ? (
                                     <div
                                      style={{
                                        position: "relative",
                                        width: 120,
                                        height: 120,
                                        borderRadius: 14,
                                        overflow: "hidden",
                                        border: "1px solid #e2e8f0",
                                        background: "#fff",
                                        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                                      }}
                                    >
                                      {" "}
                                      
                                      <img
                                        src={typeof photoUrl === "string" ? photoUrl : (photoUrl instanceof File ? URL.createObjectURL(photoUrl) : undefined)}
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                          cursor: "pointer",
                                        }}
                                        onClick={() => setZoomImage(typeof photoUrl === "string" ? photoUrl : (photoUrl instanceof File ? URL.createObjectURL(photoUrl) : null))}
                                        alt={slotLabel}
                                      />
                                      {isProgressNotePhotosEditable && !selectedTaskInfo?.task?.isHelper && (
                                         <button
                                          onClick={() =>
                                            handleRemoveSlotPhoto(
                                              shiftKey,
                                              slotIdx,
                                            )
                                          }
                                          style={{
                                            position: "absolute",
                                            top: 5,
                                            right: 5,
                                            background: "rgba(239,68,68,0.9)",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: "6px",
                                            padding: "4px",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                          }}
                                        >
                                          {" "}
                                          
                                          <Trash2 size={11} />
                                        </button>
                                      )}
                                    </div>
                                  ) : (isProgressNotePhotosEditable && !selectedTaskInfo?.task?.isHelper) ? (
                                    !isSlotTimeAllowed(slotIdx) ? (
                                      <div
                                        style={{
                                          width: 120,
                                          height: 120,
                                          border: "1px dashed #cbd5e1",
                                          borderRadius: 14,
                                          background: "#f1f5f9",
                                          display: "flex",
                                          flexDirection: "column",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          color: "#94a3b8",
                                          gap: "6px",
                                          position: "relative",
                                          cursor: "not-allowed",
                                          opacity: 0.8
                                        }}
                                        title={`ยังไม่ถึงเวลาปฏิบัติงานสำหรับส่วน "${slotLabel}"`}
                                        key={slotIdx}
                                      >
                                        <Lock size={18} style={{ color: "#94a3b8" }} />
                                        <span
                                          style={{
                                            fontSize: "0.55rem",
                                            fontWeight: 700,
                                            textAlign: "center",
                                            color: "#94a3b8",
                                            padding: "0 4px"
                                          }}
                                        >
                                          ยังไม่ถึงเวลากะ
                                        </span>
                                      </div>
                                    ) : (
                                      <label
                                      style={{
                                        width: 120,
                                        height: 120,
                                        border: "2px dashed #cbd5e1",
                                        borderRadius: 14,
                                        background: "#fff",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#94a3b8",
                                        cursor: isUploading
                                          ? "not-allowed"
                                          : "pointer",
                                        gap: "6px",
                                        transition: "all 0.2s",
                                        opacity: isUploading ? 0.6 : 1,
                                      }}
                                    >
                                      {isUploading ? (
                                         <Loader2
                                          className="animate-spin"
                                          size={22}
                                        />
                                      ) : (
                                         <Camera size={22} />
                                      )}{" "}
                                      
                                      <span
                                        style={{
                                          fontSize: "0.65rem",
                                          fontWeight: 800,
                                          textAlign: "center",
                                        }}
                                      >
                                        แนบรูป
                                      </span>{" "}
                                      
                                      <input
                                        type="file"
                                        accept="image/*"
                                        style={{
                                          display: "none",
                                        }}
                                        onChange={(e) =>
                                          handleSlotPhotoUpload(
                                            shiftKey,
                                            slotIdx,
                                            e,
                                          )
                                        }
                                        disabled={isUploading}
                                      />
                                    </label>
                                  )
                                ) : (
                                     <div
                                      style={{
                                        width: 120,
                                        height: 120,
                                        border: "1px dashed #e2e8f0",
                                        borderRadius: 14,
                                        background: "#f8fafc",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#94a3b8",
                                        gap: "4px"
                                      }}
                                    >
                                      {selectedTaskInfo?.task?.isHelper ? (
                                        <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>ไม่มีรูปถ่าย</span>
                                      ) : (
                                        <Camera size={22} />
                                      )}
                                    </div>
                                  )}{" "}
                                  
                                  <span
                                    style={{
                                      fontSize: "0.7rem",
                                      fontWeight: 900,
                                      color: "#475569",
                                      background: photoUrl
                                        ? "#d1fae5"
                                        : "#f1f5f9",
                                      padding: "3px 12px",
                                      borderRadius: "6px",
                                      border: `1px solid ${photoUrl ? "#6ee7b7" : "#e2e8f0"}`,
                                    }}
                                  >
                                    {photoUrl ? "✓ " : ""}
                                    {slotLabel}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>{" "}
              
              <div
                style={{
                  marginTop: "2.5rem",
                }}
              >
                {" "}
                
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}
                >
                  {" "}
                  
                  <h3
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 900,
                      color: "#0f172a",
                      margin: 0,
                    }}
                  >
                    หมายเหตุ (Site Notes)
                  </h3>{" "}
                  
                  <div
                    onClick={() =>
                      isProgressNotePhotosEditable &&
                      setReportType((prev) =>
                        prev === "Problem" ? "Update" : "Problem",
                      )
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 16px",
                      borderRadius: "12px",
                      background:
                        reportType === "Problem" ? "#fef2f2" : "#f8fafc",
                      border:
                        reportType === "Problem"
                          ? "1px solid #ef4444"
                          : "1px solid #e2e8f0",
                      cursor: isProgressNotePhotosEditable
                        ? "pointer"
                        : "default",
                      transition: "all 0.2s",
                    }}
                  >
                    {" "}
                    
                    <div
                      style={{
                        width: "40px",
                        height: "22px",
                        background:
                          reportType === "Problem" ? "#ef4444" : "#cbd5e1",
                        borderRadius: "20px",
                        position: "relative",
                        transition: "all 0.3s",
                      }}
                    >
                      {" "}
                      
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          background: "#fff",
                          borderRadius: "50%",
                          position: "absolute",
                          top: "3px",
                          left: reportType === "Problem" ? "21px" : "3px",
                          transition: "all 0.3s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }}
                      />
                    </div>{" "}
                    
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        color: reportType === "Problem" ? "#ef4444" : "#64748b",
                      }}
                    >
                      {reportType === "Problem"
                        ? "🚨 พบปัญหาหน้างาน"
                        : "สถานะปกติ"}
                    </span>
                  </div>
                </div>{" "}
                
                <textarea
                  placeholder={
                    reportType === "Problem"
                      ? "ระบุรายละเอียดปัญหาที่พบ..."
                      : "ระบุรายละเอียดเพิ่มเติม..."
                  }
                  disabled={!isProgressNotePhotosEditable}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    borderRadius: "16px",
                    border:
                      reportType === "Problem"
                        ? "2px solid #ef4444"
                        : "1px solid #e2e8f0",
                    background: reportType === "Problem" ? "#fff" : "#f8fafc",
                    fontSize: "0.9rem",
                    outline: "none",
                    minHeight: "100px",
                    transition: "all 0.2s",
                  }}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              {(() => {
                const history = selectedTaskInfo.task.history || [];
                const isHelperTask = selectedTaskInfo.task.isHelper === true;
                const filteredHistory = filterHistoryByRevision(history, selectedTaskInfo.task.revisionCreatedAt, selectedTaskInfo.task.currentRevision)
                  .filter((h) => h.date)
                  .filter((h) => isHelperTask ? h.isSupportReport === true : h.isSupportReport !== true);
                if (filteredHistory.length === 0) return null;
                return (
                   <div
                    style={{
                      marginTop: "2.5rem",
                    }}
                  >
                    {" "}
                    
                    <h3
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 900,
                        color: "#0f172a",
                        margin: "0 0 1.25rem 0",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      {" "}
                      
                      <Activity size={20} color="#6366f1" />{" "}
                      ประวัติการปฏิบัติงาน (Work History)
                    </h3>{" "}
                    
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      {[...filteredHistory]
                        .sort(
                          (a, b) =>
                            new Date(b.date).getTime() -
                            new Date(a.date).getTime(),
                        )
                        .map((h) => {
                          const totalManpower = h.labor.reduce(
                            (acc: number, l: any) => acc + (Number(l.amount) || 1),
                            0,
                          );
                          const hDateStr = h.date?.split("T")[0] || "";
                          return (
                             <div
                              onClick={() =>
                                handleDateChange(hDateStr)
                              }
                              style={{
                                padding: "16px",
                                borderRadius: "16px",
                                background:
                                  hDateStr === reportDate
                                    ? "#eff6ff"
                                    : h.type === "Problem"
                                      ? "#fef2f2"
                                      : "#fff",
                                border: `2px solid ${hDateStr === reportDate ? "#3b82f6" : h.type === "Problem" ? "#fecaca" : "#e2e8f0"}`,
                                boxShadow:
                                  hDateStr === reportDate
                                    ? "0 4px 12px rgba(59, 130, 246, 0.15)"
                                    : "0 2px 4px rgba(0,0,0,0.02)",
                                cursor: "pointer",
                                transition:
                                  "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                transform:
                                  hDateStr === reportDate
                                    ? "translateY(-2px)"
                                    : "none",
                              }}
                              key={`${h.id}-${h.isSupportReport ? 'support' : 'main'}`}
                            >
                              {" "}
                              
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: isMobile ? "column" : "row",
                                  justifyContent: "space-between",
                                  alignItems: isMobile ? "flex-start" : "center",
                                  marginBottom: "12px",
                                  gap: isMobile ? "6px" : "0",
                                }}
                              >
                                {" "}

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    gap: "6px",
                                  }}
                                >
                                  {" "}
                                  
                                  <div
                                    style={{
                                      fontSize: "0.9rem",
                                      fontWeight: 900,
                                      color:
                                        h.type === "Problem"
                                          ? "#ef4444"
                                          : "#1e293b",
                                    }}
                                  >
                                    {h.type === "Problem" && "🚨 "}
                                    {formatDate(h.date)}
                                  </div>{" "}
                                  
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color:
                                        h.type === "Problem"
                                          ? "#ef4444"
                                          : "#6366f1",
                                      background:
                                        h.type === "Problem"
                                          ? "#fee2e2"
                                          : "#eef2ff",
                                      padding: "2px 8px",
                                      borderRadius: "6px",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Progress: {h.progress}%
                                  </div>

                                  {selectedTaskInfo?.task?.isHelper === true && (
                                    <div
                                      style={{
                                        fontSize: "0.75rem",
                                        color: h.isSupportReport === true ? "#059669" : "#2563eb",
                                        background: h.isSupportReport === true ? "#f0fdf4" : "#eff6ff",
                                        border: `1px solid ${h.isSupportReport === true ? "#bbf7d0" : "#bfdbfe"}`,
                                        padding: "2px 8px",
                                        borderRadius: "6px",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {h.isSupportReport === true ? "งานสนับสนุน" : "งานหลัก"}
                                    </div>
                                  )}
                                </div>{" "}
                                
                                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#64748b",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {" "}

                                    <Users
                                      size={12}
                                      style={{
                                        marginRight: "4px",
                                      }}
                                    />{" "}
                                    {totalManpower} คน
                                  </div>
                                  {(() => {
                                    const firstLabor = h.labor?.[0];
                                    const shiftStr = firstLabor?.shiftTimes?.day as string | undefined;
                                    if (!shiftStr) return null;
                                    const parts = shiftStr.split(" - ");
                                    if (parts.length !== 2) return null;
                                    const startMin = parseInt(parts[0].split(":")[0], 10) * 60 + parseInt(parts[0].split(":")[1] || "0", 10);
                                    const endMin = parseInt(parts[1].split(":")[0], 10) * 60 + parseInt(parts[1].split(":")[1] || "0", 10);
                                    let diffMin = endMin - startMin;
                                    if (!firstLabor?.shifts?.otNoon && startMin <= 720 && endMin >= 780) diffMin -= 60;
                                    const hrs = Math.round((diffMin / 60) * 10) / 10;
                                    return (
                                      <div style={{ fontSize: "0.75rem", color: "#0369a1", background: "#e0f2fe", padding: "2px 8px", borderRadius: "6px", fontWeight: 700, whiteSpace: "nowrap" }}>
                                        ⏱ {shiftStr}{hrs > 0 ? ` (${hrs} ชม.)` : ""}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                              {h.note && (
                                 <div
                                  style={{
                                    fontSize: "0.85rem",
                                    color:
                                      h.type === "Problem"
                                        ? "#b91c1c"
                                        : "#475569",
                                    marginBottom: "12px",
                                    background:
                                      h.type === "Problem" ? "#fff" : "#f8fafc",
                                    padding: "10px",
                                    borderRadius: "10px",
                                    borderLeft: `3px solid ${h.type === "Problem" ? "#ef4444" : "#6366f1"}`,
                                    fontWeight:
                                      h.type === "Problem" ? 700 : 400,
                                  }}
                                >
                                  {h.type === "Problem" && (
                                     <div
                                      style={{
                                        marginBottom: "4px",
                                        fontWeight: 900,
                                      }}
                                    >
                                      รายงานปัญหาจากหน้างาน:
                                    </div>
                                  )}
                                  {h.note}
                                </div>
                              )}{" "}
                              
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "6px",
                                }}
                              >
                                {h.labor.map((l: any, lIdx: number) => (
                                   <span
                                    style={{
                                      fontSize: "0.7rem",
                                      color: "#4b5563",
                                      background: "#f1f5f9",
                                      padding: "2px 8px",
                                      borderRadius: "6px",
                                      fontWeight: 600,
                                    }}
                                    key={lIdx}
                                  >
                                    {l.staffName || l.affiliation}
                                  </span>
                                ))}
                              </div>

                              {/* ── Photo Gallery for this history entry ── */}
                              {(() => {
                                // Collect all photos from this history entry
                                const allPhotos: { url: string; label: string }[] = [];
                                const pObj = h.photos && !Array.isArray(h.photos) ? h.photos as any : null;
                                const pArr = Array.isArray(h.photos) ? h.photos as string[] : null;

                                // Site photos
                                const siteUrls: string[] = pObj
                                  ? (pObj.site || []).filter(Boolean)
                                  : (pArr || []).filter(Boolean);
                                siteUrls.forEach((url, i) => allPhotos.push({ url, label: `ไซต์ ${i + 1}` }));

                                // Shift photos (laborByShift)
                                if (pObj?.laborByShift) {
                                  const shiftLabels: Record<string, string[]> = {
                                    regular: ["เข้า", "พักเที่ยง", "เข้าบ่าย", "ออก"],
                                    otMorning: ["OT เช้า-เข้า", "OT เช้า-ออก"],
                                    otNoon: ["OT เที่ยง-เข้า", "OT เที่ยง-ออก"],
                                    otEvening: ["OT เย็น-เข้า", "OT เย็น-ออก"],
                                  };
                                  Object.entries(pObj.laborByShift).forEach(([shiftKey, shiftVal]: [string, any]) => {
                                    if (!shiftVal) return;
                                    const labels = shiftLabels[shiftKey] || [];
                                    const urls: string[] = Array.isArray(shiftVal)
                                      ? shiftVal.filter(Boolean)
                                      : [shiftVal.in, shiftVal.lunch, shiftVal.afternoon, shiftVal.out, shiftVal.out2].filter(Boolean);
                                    urls.forEach((url, i) => allPhotos.push({ url, label: labels[i] || `${shiftKey} ${i + 1}` }));
                                  });
                                }

                                // Legacy laborPhotos array
                                if (!pObj && !pArr && h.laborPhotos) {
                                  (h.laborPhotos as string[]).filter(Boolean).forEach((url: string, i: number) => allPhotos.push({ url, label: `แรงงาน ${i + 1}` }));
                                }

                                if (allPhotos.length === 0) return null;
                                const photoKey = `${h.id}-${hDateStr}`;
                                const isExpanded = expandedPhotos.has(photoKey);
                                return (
                                  <div
                                    style={{ marginTop: "10px" }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => togglePhotos(photoKey)}
                                      style={{
                                        display: "inline-flex", alignItems: "center", gap: "5px",
                                        fontSize: "0.72rem", color: isExpanded ? "#6366f1" : "#64748b",
                                        background: isExpanded ? "#eef2ff" : "#f1f5f9",
                                        border: `1px solid ${isExpanded ? "#c7d2fe" : "#e2e8f0"}`,
                                        borderRadius: "6px", padding: "3px 10px",
                                        fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                                      }}
                                    >
                                      📷 รูปถ่าย ({allPhotos.length} รูป) {isExpanded ? "▲" : "▼"}
                                    </button>
                                    {isExpanded && (
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                                        {allPhotos.map((p, pIdx) => (
                                          <div
                                            key={pIdx}
                                            onClick={() => setZoomImage(p.url)}
                                            style={{
                                              cursor: "pointer",
                                              borderRadius: "8px",
                                              overflow: "hidden",
                                              width: "60px",
                                              height: "60px",
                                              position: "relative",
                                              border: "2px solid #e2e8f0",
                                              flexShrink: 0,
                                              transition: "all 0.15s",
                                            }}
                                            onMouseOver={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.borderColor = "#6366f1"; }}
                                            onMouseOut={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
                                            title={p.label}
                                          >
                                            <img
                                              src={p.url}
                                              alt={p.label}
                                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                            />
                                            <div style={{
                                              position: "absolute", bottom: 0, left: 0, right: 0,
                                              background: "rgba(0,0,0,0.5)", color: "#fff",
                                              fontSize: "0.55rem", textAlign: "center", padding: "1px 2px",
                                              fontWeight: 600, lineHeight: 1.2
                                            }}>
                                              {p.label}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })()}
                </Fragment>
              )}
            </div>{" "}
            
            <div
              style={{
                padding: "1.5rem 2rem",
                borderTop: "1px solid #f1f5f9",
                background: "#f8fafc",
                display: "flex",
                justifyContent: "flex-end",
                gap: "1rem",
                borderBottomLeftRadius: "24px",
                borderBottomRightRadius: "24px",
              }}
            >
              {" "}
              
              <button
                onClick={() => setSelectedTaskInfo(null)}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "50%",
                  width: "44px",
                  height: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#000000",
                  transition: "all 0.2s",
                  boxShadow:
                    "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
                  padding: 0,
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#000000";
                  e.currentTarget.style.color = "#ffffff";
                  e.currentTarget.style.borderColor = "#000000";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#f8fafc";
                  e.currentTarget.style.color = "#000000";
                  e.currentTarget.style.borderColor = "#cbd5e1";
                }}
              >
                {" "}
                
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {" "}
                  
                  <line x1="18" y1="6" x2="6" y2="18" /> 
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              {(!hasHistoryForSelectedDate || isEditingExisting) &&
                !isTaskFinished &&
                !isAwaitingAdmin &&
                !selectedTaskInfo?.task?.isReadOnly && (
                   <Fragment>
                    {" "}
                    
                    <div
                      style={{
                        flex: 1,
                      }}
                    />{" "}
                    
                    <button
                      onClick={handleSaveDraft}
                      disabled={isSubmitting || isUploading}
                      style={{
                        padding: "12px 24px",
                        borderRadius: "14px",
                        border: "1.5px solid #cbd5e1",
                        background: "#fff",
                        color: "#475569",
                        fontWeight: 900,
                        cursor:
                          isSubmitting || isUploading
                            ? "not-allowed"
                            : "pointer",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        if (!isSubmitting && !isUploading) {
                          e.currentTarget.style.background = "#f8fafc";
                          e.currentTarget.style.borderColor = "#94a3b8";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSubmitting && !isUploading) {
                          e.currentTarget.style.background = "#fff";
                          e.currentTarget.style.borderColor = "#cbd5e1";
                        }
                      }}
                    >
                      บันทึกแบบร่าง
                    </button>

                    {!retroactiveSubmitDone && (
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || isUploading}
                        style={{
                          padding: "12px 32px",
                          borderRadius: "14px",
                          border: "none",
                          background: isSubmitting || isUploading ? "#94a3b8" : isReportDatePast3Days ? "#ea580c" : "#2563eb",
                          color: "#fff",
                          fontWeight: 900,
                          cursor: isSubmitting || isUploading ? "not-allowed" : "pointer",
                          boxShadow: isSubmitting || isUploading ? "none" : isReportDatePast3Days ? "0 4px 6px rgba(234,88,12,0.25)" : "0 4px 6px rgba(37,99,235,0.2)",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {(isSubmitting || isUploading) && <Loader2 className="animate-spin" size={20} />}
                        {isSubmitting ? "กำลังส่ง..." : isReportDatePast3Days ? "ส่งขอรับรอง" : "ยืนยันการส่งรายงาน"}
                      </button>
                    )}
                  </Fragment>
                )}
            </div>

            {/* Photo lightbox overlay — mobile only */}
            {isMobile && photoPreviewOpen && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0,0,0,0.93)",
                  zIndex: 9999,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={() => setPhotoPreviewOpen(false)}
              >
                <button
                  style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    background: "rgba(255,255,255,0.15)",
                    border: "none",
                    borderRadius: "50%",
                    width: "44px",
                    height: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#fff",
                    fontSize: "1.2rem",
                    fontWeight: 700,
                  }}
                  onClick={(e) => { e.stopPropagation(); setPhotoPreviewOpen(false); }}
                >
                  ✕
                </button>
                {photoPreviewUrl && (
                  <img
                    src={photoPreviewUrl}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                    }}
                    alt="Preview"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
            )}

            {/* SLA popup overlay — mobile only */}
            {isMobile && showSLAPopup && selectedTaskInfo && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0,0,0,0.5)",
                  zIndex: 9998,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px",
                }}
                onClick={() => setShowSLAPopup(false)}
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "16px",
                    padding: "20px 16px 16px",
                    width: "100%",
                    maxWidth: "360px",
                    maxHeight: "80vh",
                    overflowY: "auto",
                    position: "relative",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      background: "#f1f5f9",
                      border: "none",
                      borderRadius: "50%",
                      width: "32px",
                      height: "32px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#64748b",
                      fontSize: "1rem",
                      fontWeight: 700,
                    }}
                    onClick={() => setShowSLAPopup(false)}
                  >
                    ✕
                  </button>
                  <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#0f172a", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Clock size={14} color="#2563eb" /> SLA
                  </div>
                  {(() => {
                    const isHelperTask = selectedTaskInfo.task.isHelper === true;
                    const slaDuration = (selectedTaskInfo.task.slaCategory && SLA_HOURS_MAP[selectedTaskInfo.task.slaCategory]) || 24;
                    let globalDeadlineTime: number | undefined = undefined;
                    const woId = selectedTaskInfo.wo.id;
                    if (isHelperTask) {
                      const helperDue = selectedTaskInfo.task.dueDate ? new Date(selectedTaskInfo.task.dueDate).getTime() : 0;
                      if (helperDue > 0) { globalDeadlineTime = helperDue; }
                    } else {
                      const fullWo = workOrders.find((w) => w.id === woId);
                      if (fullWo) {
                        const jobSla = computeJobSLA(fullWo);
                        if (jobSla.deadlineMs) { globalDeadlineTime = jobSla.deadlineMs; }
                      }
                    }
                    const isCompleted100 = (selectedTaskInfo.task.dailyProgress || 0) >= 100;
                    const appointmentDateVal = selectedTaskInfo.wo.appointmentDate || selectedTaskInfo.task.startDate;
                    let actualStartVal: string | undefined = undefined;
                    if (selectedTaskInfo.task.history && selectedTaskInfo.task.history.length > 0) {
                      const history = selectedTaskInfo.task.history || [];
                      const filteredHistory = filterHistoryByRevision(history, selectedTaskInfo.task.revisionCreatedAt, selectedTaskInfo.task.currentRevision);
                      const sortedHistory = [...filteredHistory].filter((h) => h.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      if (sortedHistory.length > 0) { actualStartVal = sortedHistory[0].date; }
                    }
                    return (
                      <SLACountdown
                        startTime={
                          isHelperTask
                            ? (selectedTaskInfo.task.dueDate || new Date().toISOString())
                            : ((selectedTaskInfo.task.startDate && typeof selectedTaskInfo.task.startDate === 'string'
                                ? `${selectedTaskInfo.task.startDate.split('T')[0]}T08:00:00`
                                : selectedTaskInfo.task.slaStartTime) || new Date().toISOString())
                        }
                        durationHours={isHelperTask ? 0 : slaDuration}
                        appointmentDate={appointmentDateVal || void 0}
                        actualStartDate={actualStartVal || void 0}
                        isCompleted={isCompleted100}
                        groupDeadline={globalDeadlineTime}
                        isHelper={isHelperTask}
                      />
                    );
                  })()}
                </div>
              </div>
            )}
          </Fragment>
        )}
      </div>
  );
};
