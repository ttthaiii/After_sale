import React from "react";
import {
  Lock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Info,
  ChevronLeft,
} from "lucide-react";
import { DailyReportProvider, useDailyReport } from "../context/DailyReportContext";
import { formatDate } from "../utils/date";
import { WorkOrderGroupList } from "../components/daily-report/WorkOrderGroupList";
import { DailyReportDetailPane } from "../components/daily-report/DailyReportDetailPane";
import { PreHandoverDetailPane } from "../components/daily-report/PreHandoverDetailPane";
import { DailyReportSummaryModal } from "../components/daily-report/DailyReportSummaryModal";
import { BatchAddModal } from "../components/daily-report/BatchAddModal";
import { AnalogTimePicker } from "../components/AnalogTimePicker";
import TaskReviewModal from "../components/TaskReviewModal";
import CustomerInspectionMockup from "../components/CustomerInspectionMockup";
import { useIsMobile } from "../hooks/useIsMobile";

const TaskReviewModalAny = TaskReviewModal as any;

const DailyReportContent: React.FC = () => {
  const {
    selectedPhCatInfo,
    isSidebarOpen,
    timePickerTarget,
    setTimePickerTarget,
    activeModal,
    setActiveModal,
    showSummaryModal,
    showUnlockModal,
    setShowUnlockModal,
    selectedTaskInfo,
    setSelectedTaskInfo,
    setSelectedPhCatInfo,
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
  } = useDailyReport();
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : (isSidebarOpen ? "360px 1fr" : "1fr"),
        gap: isMobile ? "1rem" : "2rem",
        height: isMobile ? "auto" : "calc(100vh - 120px)",
        transition: "grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Sidebar Accodion */}
      {isSidebarOpen && <WorkOrderGroupList />}

      {/* Main Details Form Pane */}
      {(() => {
        const hasSelection = !!selectedTaskInfo || !!selectedPhCatInfo;
        const detailPane = selectedPhCatInfo ? (
          <PreHandoverDetailPane />
        ) : (
          <DailyReportDetailPane />
        );

        // Desktop: unchanged — pane sits in the 2-column grid beside the list.
        if (!isMobile) return detailPane;

        // Mobile: no inline pane stacked at the bottom. When a work order is
        // selected, present the form as a full-screen popup overlay instead.
        if (!hasSelection) return null;

        return (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1500,
              background: "#fff",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <button
                onClick={() => {
                  setSelectedTaskInfo(null);
                  setSelectedPhCatInfo(null);
                }}
                aria-label="ย้อนกลับ"
                style={{
                  width: "44px",
                  height: "44px",
                  padding: 0,
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#0f172a",
                  flexShrink: 0,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div
                style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}
              >
                รายงานผลงาน
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>{detailPane}</div>
          </div>
        );
      })()}

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
