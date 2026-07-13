import React, { useState } from "react";
import {
  Lock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Info,
  ChevronLeft,
  Activity,
  X,
} from "lucide-react";
import { DailyReportProvider, useDailyReport, filterHistoryByRevision } from "../context/DailyReportContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { formatDate } from "../utils/date";
import { WorkOrderGroupList } from "../components/daily-report/WorkOrderGroupList";
import { DailyReportDetailPane } from "../components/daily-report/DailyReportDetailPane";
import { SLACountdown } from "../components/daily-report/SLACountdowns";
import { DailyReportSummaryModal } from "../components/daily-report/DailyReportSummaryModal";
import { BatchAddModal } from "../components/daily-report/BatchAddModal";
import { AnalogTimePicker } from "../components/AnalogTimePicker";
import TaskReviewModal from "../components/TaskReviewModal";
import CustomerInspectionMockup from "../components/CustomerInspectionMockup";

const TaskReviewModalAny = TaskReviewModal as any;

const DailyReportContent: React.FC = () => {
  const isMobile = useIsMobile();
  const [showSLAModal, setShowSLAModal] = useState(false);
  const {
    isSidebarOpen,
    selectedTaskInfo,
    setSelectedTaskInfo,
    timePickerTarget,
    setTimePickerTarget,
    activeModal,
    setActiveModal,
    showSummaryModal,
    showUnlockModal,
    setShowUnlockModal,
    zoomImage,
    setZoomImage,
    isReviewModalOpen,
    setIsReviewModalOpen,
    reviewTaskInfo,
    setReviewTaskInfo,
    isCustomerMockupOpen,
    setIsCustomerMockupOpen,
    mockupWorkOrder,
    setMockupWorkOrder,
    handleConfirmReview,
    handleBounceBackSLA,
    submitCustomerInspection,
    pendingUnlockDate,
    unlockReason,
    setUnlockReason,
    requestRetroactiveUnlock,
    handleTimeChange,
    handleBatchAdd,
    availableStaff,
    availableContractors,
    modalAlert,
    setModalAlert,
    setReportDate,
    workOrders,
  } = useDailyReport();

  return (
    <div
      style={isMobile ? {
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 56px - 2rem)",
        position: "relative",
      } : {
        display: "grid",
        gridTemplateColumns: isSidebarOpen ? "360px 1fr" : "1fr",
        gap: "2rem",
        height: "calc(100vh - 120px)",
        transition: "grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Mobile: header row — back button (left) + SLA button (right) */}
      {isMobile && selectedTaskInfo && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "0.5rem", flexShrink: 0 }}>
          <button
            onClick={() => setSelectedTaskInfo(null)}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#4f46e5", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", padding: 0 }}
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
            กลับรายการงาน
          </button>
          {!selectedTaskInfo.task.isHelper && (() => {
            const slaHoursMap: Record<string, number> = { Immediately: 4, "24h": 24, "1-3d": 72, "3-7d": 168, "7-14d": 336, "14-30d": 720 };
            const cat = selectedTaskInfo.task.slaCategory;
            const dur = (cat && slaHoursMap[cat]) || 24;
            const rawStart = selectedTaskInfo.task.startDate;
            const startMs = rawStart && typeof rawStart === "string"
              ? new Date(`${rawStart.split("T")[0]}T08:00:00`).getTime()
              : Date.now();
            const deadlineMs = startMs + dur * 3600000;
            const remainMs = deadlineMs - Date.now();
            const isOverdue = remainMs < 0;
            const elapsedMs = Math.abs(remainMs);
            const elapsedDays = Math.floor(elapsedMs / 86400000);
            const elapsedHours = Math.floor(elapsedMs / 3600000);
            const remainDays = Math.floor(remainMs / 86400000);
            const remainHours = Math.floor(remainMs / 3600000);

            const btnBg = isOverdue ? "#fef2f2" : "#eff6ff";
            const btnBorder = isOverdue ? "#fecaca" : "#dbeafe";
            const btnColor = isOverdue ? "#dc2626" : "#1e40af";
            const badgeBg = isOverdue ? "#fee2e2" : "#dbeafe";
            const badgeColor = isOverdue ? "#dc2626" : "#3b82f6";
            const badgeLabel = isOverdue
              ? (elapsedDays >= 1 ? `เลย ${elapsedDays} วัน` : `เลย ${elapsedHours} ชม.`)
              : (remainDays >= 1 ? `เหลือ ${remainDays} วัน` : `เหลือ ${remainHours} ชม.`);

            return (
              <button
                onClick={() => setShowSLAModal(true)}
                style={{ display: "flex", alignItems: "center", gap: "5px", background: btnBg, border: `1px solid ${btnBorder}`, borderRadius: "10px", padding: "6px 12px", cursor: "pointer", fontSize: "0.78rem", fontWeight: 800, color: btnColor }}
              >
                <Activity size={13} />
                SLA
                <span style={{ fontSize: "0.68rem", color: badgeColor, background: badgeBg, padding: "1px 6px", borderRadius: "5px", fontWeight: 900 }}>
                  {badgeLabel}
                </span>
              </button>
            );
          })()}
        </div>
      )}

      {/* SLA popup modal (mobile-only) */}
      {isMobile && showSLAModal && selectedTaskInfo && (() => {
        const slaHoursMap: Record<string, number> = { Immediately: 4, "24h": 24, "1-3d": 72, "3-7d": 168, "7-14d": 336, "14-30d": 720 };
        const slaDuration = (selectedTaskInfo.task.slaCategory && slaHoursMap[selectedTaskInfo.task.slaCategory]) || 24;
        const woId = selectedTaskInfo.wo.id;
        let globalDeadlineTime: number | undefined = undefined;
        const fullWo = (workOrders as any[]).find((w: any) => w.id === woId);
        if (fullWo) {
          const isWoaWop = woId.toUpperCase().includes("WOA") || woId.toUpperCase().includes("WOP");
          let maxDl = 0;
          (fullWo.categories as any[]).forEach((cat: any) => {
            (cat.tasks as any[]).forEach((t: any) => {
              if (isWoaWop && !t.slaCategory) return;
              const tSla = t.slaCategory || t.baselineSla || t.estimatedSla || "24h";
              const tDur = slaHoursMap[tSla] || 24;
              const tStart = t.startDate && typeof t.startDate === "string" ? `${t.startDate.split("T")[0]}T08:00:00` : (t.slaStartTime || fullWo.createdAt || new Date().toISOString());
              const dl = new Date(tStart).getTime() + tDur * 3600000;
              if (dl > maxDl) maxDl = dl;
            });
          });
          if (maxDl > 0) globalDeadlineTime = maxDl;
        }
        const isCompleted = (selectedTaskInfo.task.dailyProgress || 0) >= 100;
        const apptDate = selectedTaskInfo.wo.appointmentDate || selectedTaskInfo.task.startDate;
        let actualStart: string | undefined = undefined;
        if ((selectedTaskInfo.task.history ?? []).length > 0) {
          const filtered = filterHistoryByRevision(selectedTaskInfo.task.history ?? [], selectedTaskInfo.task.revisionCreatedAt, selectedTaskInfo.task.currentRevision);
          const sorted = [...filtered].filter((h: any) => h.date).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          if (sorted.length > 0) actualStart = sorted[0].date;
        }
        return (
          <div
            onClick={() => setShowSLAModal(false)}
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.55)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ width: "100%", maxWidth: "480px", background: "#fff", borderRadius: "20px", padding: "20px 16px 24px 16px", maxHeight: "85vh", overflowY: "auto" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Activity size={16} color="#1e40af" /> การประเมินกำหนดส่งเป้าหมาย (SLA)
                </span>
                <button onClick={() => setShowSLAModal(false)} style={{ border: "none", background: "#f1f5f9", borderRadius: "8px", padding: "6px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                  <X size={16} color="#64748b" />
                </button>
              </div>
              <SLACountdown
                startTime={(selectedTaskInfo.task.startDate && typeof selectedTaskInfo.task.startDate === "string" ? `${selectedTaskInfo.task.startDate.split("T")[0]}T08:00:00` : selectedTaskInfo.task.slaStartTime) || new Date().toISOString()}
                durationHours={slaDuration}
                appointmentDate={apptDate || undefined}
                actualStartDate={actualStart}
                isCompleted={isCompleted}
                groupDeadline={globalDeadlineTime}
                isHelper={false}
              />
            </div>
          </div>
        );
      })()}

      {/* List panel: always on desktop (controlled by isSidebarOpen), only when no task on mobile */}
      {isMobile ? (
        !selectedTaskInfo ? <WorkOrderGroupList /> : null
      ) : (
        isSidebarOpen && <WorkOrderGroupList />
      )}

      {/* Detail pane: always on desktop, only when task selected on mobile */}
      {(!isMobile || selectedTaskInfo) && <DailyReportDetailPane />}

      {/* Analog Time Picker Modal Overlay */}
      {timePickerTarget && (
        <AnalogTimePicker
          value={timePickerTarget.currentValue}
          onChange={handleTimeChange}
          onClose={() => setTimePickerTarget(null)}
        />
      )}

      {/* Batch Add Modal Overlay */}
      {activeModal && (
        <BatchAddModal
          type={activeModal}
          availableItems={
            activeModal === "Internal" ? availableStaff : availableContractors
          }
          onClose={() => setActiveModal(null)}
          onAdd={handleBatchAdd}
        />
      )}

      {/* Daily Report Submit Summary Modal Overlay */}
      {showSummaryModal && <DailyReportSummaryModal />}

      {/* Retroactive Warning Modal */}
      {showUnlockModal && selectedTaskInfo && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(8px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "24px", padding: "2rem", width: "440px", maxWidth: "90%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ background: "#fff7ed", padding: "10px", borderRadius: "12px", color: "#ea580c" }}>
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, color: "#0f172a" }}>รายงานย้อนหลัง (เกิน 3 วัน)</h3>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>วันที่ {formatDate(pendingUnlockDate)}</p>
              </div>
            </div>
            <div style={{ padding: "14px 16px", background: "#fff7ed", borderRadius: "14px", border: "1px solid #fed7aa" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e", fontWeight: 600, lineHeight: 1.6 }}>
                ข้อมูลที่คุณลงในวันนี้<strong>จะถูกส่งรอการรับรอง</strong>จากผู้รับผิดชอบก่อนจึงจะถูกบันทึกลงระบบ<br />
                กรอกข้อมูลได้ตามปกติ แล้วกด <strong>"ส่งขอรับรอง"</strong>
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { setShowUnlockModal(false); setUnlockReason(""); }} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1px solid #cbd5e1", background: "#fff", color: "#64748b", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                ยกเลิก
              </button>
              <button
                onClick={() => { setReportDate(pendingUnlockDate); setShowUnlockModal(false); setUnlockReason(""); }}
                style={{ flex: 2, padding: "12px", borderRadius: "12px", border: "none", background: "#ea580c", color: "#fff", fontSize: "0.85rem", fontWeight: 900, cursor: "pointer" }}
              >
                รับทราบ / ดำเนินการต่อ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal Overlay (Direct Slice) */}
      {zoomImage && (
         <div
          onClick={() => setZoomImage(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(12px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <img
            src={zoomImage}
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              objectFit: "contain",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
            alt="Zoomed view"
          />
        </div>
      )}

      {/* Modal Alert Overlay (Direct Slice) */}
      {modalAlert && modalAlert.isOpen && (
         <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2e3,
            padding: "2rem",
            animation: "fadeIn 0.3s ease",
          }}
        >
          {" "}
          
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              borderRadius: "24px",
              padding: "2.5rem",
              maxWidth: "480px",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.1)",
              animation: "scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {" "}
            
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "20px",
                background:
                  modalAlert.type === "success"
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : modalAlert.type === "warning"
                      ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                      : modalAlert.type === "error"
                        ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                        : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem auto",
                boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
              }}
            >
              {modalAlert.type === "success" ? (
                 <CheckCircle2 size={32} />
              ) : modalAlert.type === "warning" ? (
                 <AlertCircle size={32} />
              ) : modalAlert.type === "error" ? (
                 <XCircle size={32} />
              ) : (
                 <Info size={32} />
              )}
            </div>{" "}
            
            <h3
              style={{
                margin: "0 0 0.75rem 0",
                fontSize: "1.4rem",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {modalAlert.title}
            </h3>{" "}
            
            <p
              style={{
                margin: "0 0 2rem 0",
                fontSize: "0.95rem",
                color: "#475569",
                lineHeight: 1.6,
                fontWeight: 500,
              }}
            >
              {modalAlert.message}
            </p>{" "}
            
            <button
              onClick={() => setModalAlert(null)}
              style={{
                width: "100%",
                padding: "12px 24px",
                background: "#0f172a",
                color: "#ffffff",
                border: "none",
                borderRadius: "14px",
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
              }}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* Task Review Modal (Typecasted to bypass external props clashing) */}
      {isReviewModalOpen && reviewTaskInfo && (
        <TaskReviewModalAny
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setReviewTaskInfo(null);
          }}
          task={reviewTaskInfo.task}
          categoryId={reviewTaskInfo.categoryId}
          woId={reviewTaskInfo.woId}
          wo={reviewTaskInfo.wo}
          onConfirm={handleConfirmReview}
          onBounceBack={handleBounceBackSLA}
        />
      )}

      {/* Customer Inspection Mockup */}
      {isCustomerMockupOpen && mockupWorkOrder && (
        <CustomerInspectionMockup
          isOpen={isCustomerMockupOpen}
          onClose={() => {
            setIsCustomerMockupOpen(false);
            setMockupWorkOrder(null);
          }}
          workOrder={mockupWorkOrder}
          onSubmitInspection={(approvals, survey) => submitCustomerInspection(mockupWorkOrder.id, approvals, survey)}
        />
      )}
    </div>
  );
};

const DailyReport: React.FC = () => {
  return (
    <DailyReportProvider>
      <DailyReportContent />
    </DailyReportProvider>
  );
};

export default DailyReport;
