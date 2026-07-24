import React, { useState } from 'react';
import {
  ClipboardList, Calendar, Users, Camera, CheckCircle2,
  FileText, Clock, Plus, Trash2, Loader2,
  ChevronLeft, AlertTriangle, ChevronRight, Activity, User, HardHat,
  Edit2, XCircle,
} from 'lucide-react';
import { useDailyReport } from '../../context/DailyReportContext';
import { PreHandoverSummaryModal } from './PreHandoverSummaryModal';
import { computeJobSLA } from '../../utils/jobSla';
import { useIsMobile } from '../../hooks/useIsMobile';
import { gridCols } from '../ui/responsiveGrid';
import { ModalCloseButton } from '../ui/ModalCloseButton';

// ─── Inline Calendar Component ───────────────────────────────────────────────
const MONTH_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const DAY_SHORT = ['อา','จ','อ','พ','พฤ','ศ','ส'];

interface PhCalendarProps {
  reportDate: string;
  onSelectDate: (d: string) => void;
  getDateStatus: (d: string) => 'disabled' | 'reported' | 'unlocked' | 'locked';
}

const PhCalendar: React.FC<PhCalendarProps> = ({ reportDate, onSelectDate, getDateStatus }) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const DOT_COLOR: Record<string, string> = {
    reported: '#10b981',
    unlocked: '#f59e0b',
    locked: '#ef4444',
    disabled: 'transparent',
  };

  return (
    <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '14px', width: '100%', boxSizing: 'border-box' }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b', display: 'flex' }}><ChevronLeft size={16} /></button>
        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>{MONTH_TH[month]} {year + 543}</span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b', display: 'flex' }}><ChevronRight size={16} /></button>
      </div>
      {/* Headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
        {DAY_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', padding: '2px 0' }}>{d}</div>
        ))}
      </div>
      {/* Days */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const mm = String(month + 1).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          const dateStr = `${year}-${mm}-${dd}`;
          const status = getDateStatus(dateStr);
          const isSelected = dateStr === reportDate;
          const isDisabled = status === 'disabled';
          const todayStr = new Date().toISOString().split('T')[0];
          const isToday = dateStr === todayStr;
          return (
            <div
              key={idx}
              onClick={() => !isDisabled && onSelectDate(dateStr)}
              style={{
                position: 'relative', textAlign: 'center', padding: '6px 2px 10px',
                borderRadius: '8px', cursor: isDisabled ? 'default' : 'pointer',
                background: isSelected ? '#0d9488' : isToday ? '#f0fdfa' : 'transparent',
                color: isDisabled ? '#cbd5e1' : isSelected ? '#fff' : '#0f172a',
                fontWeight: isSelected || isToday ? 800 : 600,
                fontSize: '0.82rem',
                transition: 'background 0.1s',
              }}
            >
              {day}
              {status !== 'disabled' && (
                <span style={{
                  position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)',
                  width: '4px', height: '4px', borderRadius: '50%',
                  background: isSelected ? '#fff' : DOT_COLOR[status],
                  display: 'block',
                }} />
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          { color: '#10b981', label: 'มีข้อมูล' },
          { color: '#f59e0b', label: 'ยังไม่ได้ลง' },
          { color: '#ef4444', label: 'ไม่มีข้อมูล' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, display: 'inline-block' }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

// SLA hours map now lives in src/utils/jobSla.ts (computeJobSLA) — single source of truth.


export const PreHandoverDetailPane: React.FC = () => {
  const {
    selectedPhCatInfo,
    selectPhCatInfo,
    reportDate,
    setReportDate,
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
    handleSlotPhotoUpload,
    handleRemoveSlotPhoto,
    togglePhShift,
    openTimePicker,
    phDailyHistory,
    savePhDraft,
    getPhDateStatus,
    isPhReportDatePast3Days,
    phRetroactiveSubmitDone,
    submitPhRetroactiveRequest,
    isPhEditingExisting,
    setIsPhEditingExisting,
    isPhExistingReport,
    hasPhUnsavedChanges,
    setShowPhSummaryModal,
    phProgressBounds,
    isSubmitting,
    isUploading,
    isSidebarOpen,
    setIsSidebarOpen,
    realProjects,
    zoomImage,
    setZoomImage,
    setActiveModal,
  } = useDailyReport();

  const isMobile = useIsMobile();
  // availableStaff / availableContractors now consumed by BatchAddModal via context

  const isPhEditable = !isPhExistingReport || isPhEditingExisting;

  const renderPhTimeInput = (id: string, shift: string, rangeStr: string) => {
    const [start, end] = rangeStr.split(' - ').map(s => s.trim());
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: isPhEditingExisting ? 'auto' : 'none' }}>
        <div
          onClick={() => openTimePicker(id, shift, 'start')}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: '#334155', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
        >
          <Clock size={12} color="#94a3b8" />{start}
        </div>
        <span style={{ color: '#cbd5e1', fontWeight: 700 }}>-</span>
        <div
          onClick={() => openTimePicker(id, shift, 'end')}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: '#334155', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
        >
          {end}
        </div>
      </div>
    );
  };

  const [activePhotoTab, setActivePhotoTab] = useState('site');
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const [expandedHistoryPhotos, setExpandedHistoryPhotos] = useState<Set<string>>(new Set());
  const [phReportType, setPhReportType] = useState<'Normal' | 'Problem'>('Normal');

  const toggleHistoryPhotos = (key: string) => {
    setExpandedHistoryPhotos(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (!selectedPhCatInfo) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', color: '#94a3b8', gap: '12px',
        background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0',
      }}>
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            style={{
              position: 'absolute', top: '120px', left: '24px',
              background: '#3b82f6', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '10px 16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem',
            }}
          >
            <ChevronLeft size={16} /> แสดงรายการงาน
          </button>
        )}
        <ClipboardList size={48} style={{ opacity: 0.3 }} />
        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>เลือกหมวดงานจากแถบซ้ายเพื่อบันทึกรายงาน</div>
      </div>
    );
  }

  const { wo, cat } = selectedPhCatInfo;
  const project = realProjects.find((p: any) => p.id === wo.projectId);

  // SLA deadline — job-level via central helper (wo.scheduledDate@08:00 + phActualSla, no Date.now / 720 fallback).
  const _jobSla = computeJobSLA(wo);
  const phDeadlineMs = _jobSla.deadlineMs ?? Date.now();
  const daysLeft = _jobSla.deadlineMs !== null ? Math.ceil((phDeadlineMs - Date.now()) / 86400000) : 0;
  const deadlineLabel = _jobSla.deadlineMs !== null ? new Date(phDeadlineMs).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  // Photo map
  const photoMap: Record<string, (File | string | null)[]> = {
    site: sitePhotos,
    regular: laborRegularPhotos,
    otMorning: laborOtMorningPhotos,
    otNoon: laborOtNoonPhotos,
    otEvening: laborOtEveningPhotos,
  };

  // Photo shift slot helpers (mirrored from AfterSale)
  const getShiftTime = (key: string): string => {
    const times = labor
      .filter(l => l.shifts?.[(key === 'day' ? 'normal' : key) as keyof typeof l.shifts])
      .map(l => (l as any).shiftTimes?.[key])
      .filter(Boolean);
    return times[0] || '';
  };
  const parseStart = (r: string) => r?.split(' - ')[0] || '';
  const parseEnd = (r: string) => r?.split(' - ')[1] || '';

  const isSlotTimeAllowed = (shiftKey: string, slotIdx: number): boolean => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (reportDate < todayStr) return true;
    if (reportDate > todayStr) return false;
    const now = new Date();
    const ch = now.getHours(); const cm = now.getMinutes();
    const reached = (t: string, dh: number) => {
      if (!t) return ch >= dh;
      const [h, m] = t.split(':').map(Number);
      return ch > h || (ch === h && cm >= m);
    };
    if (shiftKey === 'regular') {
      const dayRange = getShiftTime('day');
      const startT = parseStart(dayRange); const endT = parseEnd(dayRange);
      const normalLabor = labor.filter(l => l.shifts?.normal);
      const parseH = (r: string, def: number) => { const p = r?.split(' - ')[0]; if (!p) return def; const [h,m] = p.split(':').map(Number); return isNaN(h) ? def : h + (isNaN(m) ? 0 : m)/60; };
      const parseEH = (r: string, def: number) => { const p = r?.split(' - ')[1]; if (!p) return def; const [h,m] = p.split(':').map(Number); return isNaN(h) ? def : h + (isNaN(m) ? 0 : m)/60; };
      const minS = normalLabor.length > 0 ? normalLabor.reduce((mn, l) => Math.min(mn, parseH((l as any).shiftTimes?.day||'08:00 - 17:00', 8)), 24) : 8;
      const maxE = normalLabor.length > 0 ? normalLabor.reduce((mx, l) => Math.max(mx, parseEH((l as any).shiftTimes?.day||'08:00 - 17:00', 17)), 0) : 17;
      const req = (minS >= 13 || maxE <= 12) ? 2 : 4;
      if (req === 2) { return slotIdx === 0 ? reached(startT, minS >= 13 ? 13 : 8) : reached(endT, 17); }
      if (slotIdx === 0) return reached(startT, 8);
      if (slotIdx === 1) return reached('12:00', 12);
      if (slotIdx === 2) return reached('13:00', 13);
      return reached(endT, 17);
    } else {
      const otRange = getShiftTime(shiftKey);
      const startT = parseStart(otRange); const endT = parseEnd(otRange);
      const defStart = shiftKey === 'otMorning' ? 6 : shiftKey === 'otNoon' ? 12 : 17;
      const defEnd = shiftKey === 'otMorning' ? 8 : shiftKey === 'otNoon' ? 13 : 20;
      return slotIdx === 0 ? reached(startT, defStart) : reached(endT, defEnd);
    }
  };

  const getSlotLabels = (shiftKey: string): string[] => {
    if (shiftKey === 'regular') {
      const dayRange = getShiftTime('day');
      const startT = parseStart(dayRange); const endT = parseEnd(dayRange);
      const normalLabor = labor.filter(l => l.shifts?.normal);
      const parseH = (r: string, def: number) => { const p = r?.split(' - ')[0]; if (!p) return def; const [h,m] = p.split(':').map(Number); return isNaN(h) ? def : h + (isNaN(m) ? 0 : m)/60; };
      const parseEH = (r: string, def: number) => { const p = r?.split(' - ')[1]; if (!p) return def; const [h,m] = p.split(':').map(Number); return isNaN(h) ? def : h + (isNaN(m) ? 0 : m)/60; };
      const minS = normalLabor.length > 0 ? normalLabor.reduce((mn, l) => Math.min(mn, parseH((l as any).shiftTimes?.day||'08:00 - 17:00', 8)), 24) : 8;
      const maxE = normalLabor.length > 0 ? normalLabor.reduce((mx, l) => Math.max(mx, parseEH((l as any).shiftTimes?.day||'08:00 - 17:00', 17)), 0) : 17;
      const req = (minS >= 13 || maxE <= 12) ? 2 : 4;
      if (req === 2) return minS >= 13 ? [startT ? `เข้าบ่าย (${startT})` : 'เข้าบ่าย', endT ? `ออก (${endT})` : 'ออก'] : [startT ? `เช้า (${startT})` : 'เช้า', endT ? `ออก (${endT})` : 'ออก'];
      return [startT ? `เช้า (${startT})` : 'เช้า', 'พักเที่ยง (12:00)', 'เข้าบ่าย (13:00)', endT ? `ออก (${endT})` : 'ออก'];
    } else {
      const otRange = getShiftTime(shiftKey);
      const startT = parseStart(otRange); const endT = parseEnd(otRange);
      return [startT ? `เข้า (${startT})` : 'เข้า', endT ? `ออก (${endT})` : 'ออก'];
    }
  };

  const sectionStyle: React.CSSProperties = {
    background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0',
    padding: '20px', marginBottom: '16px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '0.88rem', fontWeight: 800, color: '#0f172a',
    marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
  };

  const photoTabs = [
    { id: 'site', label: 'รูปถ่ายหน้างาน', required: 2, current: sitePhotos.filter(Boolean).length, show: true },
    { id: 'regular', label: 'กะปกติ', required: getSlotLabels('regular').length, current: laborRegularPhotos.filter(Boolean).length, show: labor.some(l => l.shifts?.normal) },
    { id: 'otMorning', label: 'OT เช้า', required: 2, current: laborOtMorningPhotos.filter(Boolean).length, show: labor.some(l => l.shifts?.otMorning) },
    { id: 'otNoon', label: 'OT เที่ยง', required: 2, current: laborOtNoonPhotos.filter(Boolean).length, show: labor.some(l => l.shifts?.otNoon) },
    { id: 'otEvening', label: 'OT เย็น', required: 2, current: laborOtEveningPhotos.filter(Boolean).length, show: labor.some(l => l.shifts?.otEvening) },
  ].filter(t => t.show);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0',
      overflow: 'hidden',
    }}>
      {/* ─── Header ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
        padding: '20px 24px', color: '#fff', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(255,255,255,0.2)', padding: '3px 10px',
                borderRadius: '20px', fontSize: '0.72rem', fontWeight: 800,
              }}>{wo.id}</span>
              <span style={{
                background: 'rgba(255,255,255,0.15)', padding: '3px 10px',
                borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
              }}>ตรวจรับก่อนโอน</span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cat.name}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>
              {wo.locationName || project?.name || '—'} · {cat.defectCount || 0} จุดตรวจสอบ
            </div>
          </div>
          <ModalCloseButton onClick={() => selectPhCatInfo(null)} variant="dark" style={{ borderRadius: '8px' }} />
        </div>

        {/* SLA + Scheduled date row */}
        <div style={{
          marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap',
          background: 'rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 14px',
        }}>
          <div>
            <div style={{ fontSize: '0.65rem', opacity: 0.75, fontWeight: 600, marginBottom: '2px' }}>วันนัดดำเนินการ</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
              {wo.scheduledDate
                ? new Date(wo.scheduledDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                : '—'}
            </div>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.25)' }} />
          <div>
            <div style={{ fontSize: '0.65rem', opacity: 0.75, fontWeight: 600, marginBottom: '2px' }}>กำหนดแล้วเสร็จ</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{deadlineLabel}</div>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.25)' }} />
          <div>
            <div style={{ fontSize: '0.65rem', opacity: 0.75, fontWeight: 600, marginBottom: '2px' }}>เหลือเวลา</div>
            <div style={{
              fontSize: '0.85rem', fontWeight: 800,
              color: daysLeft < 0 ? '#fca5a5' : daysLeft <= 3 ? '#fde68a' : '#a7f3d0',
            }}>
              {daysLeft > 0 ? `${daysLeft} วัน` : daysLeft === 0 ? 'วันนี้!' : `เกิน ${Math.abs(daysLeft)} วัน`}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <div style={{ fontSize: '0.65rem', opacity: 0.75, fontWeight: 600, marginBottom: '2px' }}>ความคืบหน้ารวม</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{cat.dailyProgress || 0}%</div>
          </div>
        </div>
      </div>

      {/* ─── Scrollable body ─── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '20px 24px' }}>

        {/* Report Date — compact button + dropdown */}
        <div style={{ ...sectionStyle, padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              รายงานระบุวันที่
            </div>
            <div
              onClick={() => setShowCalendarDropdown(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                color: '#1e40af', fontSize: '0.88rem', fontWeight: 900,
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              <Calendar size={14} />
              <span>
                {reportDate
                  ? new Date(reportDate).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
                  : '—'}
              </span>
            </div>
            {showCalendarDropdown && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                zIndex: 1000, background: '#fff', border: '1px solid #cbd5e1',
                borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                padding: '16px', width: isMobile ? '100%' : '280px',
              }}>
                <PhCalendar
                  reportDate={reportDate}
                  onSelectDate={d => {
                    if (d !== reportDate && hasPhUnsavedChanges) {
                      const ok = window.confirm(
                        'คุณมีข้อมูลรายงานที่ยังไม่ได้บันทึกค้างอยู่ หากเปลี่ยนวันที่ ข้อมูลที่กรอกไว้ทั้งหมดจะสูญหาย\n\nต้องการเปลี่ยนวันที่หรือไม่?'
                      );
                      if (!ok) return;
                    }
                    setReportDate(d);
                    setShowCalendarDropdown(false);
                  }}
                  getDateStatus={getPhDateStatus}
                />
              </div>
            )}
          </div>
        </div>

        {/* Retroactive alert */}
        {isPhReportDatePast3Days && (
          <div style={{
            ...sectionStyle,
            background: phRetroactiveSubmitDone ? '#f0fdf4' : '#fff7ed',
            border: `1px solid ${phRetroactiveSubmitDone ? '#bbf7d0' : '#fdba74'}`,
            padding: '14px 18px',
          }}>
            {phRetroactiveSubmitDone ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#15803d' }}>
                <CheckCircle2 size={18} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>ส่งคำขอแล้ว — รอผู้รับผิดชอบอนุมัติ</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>เมื่ออนุมัติแล้วจะสามารถบันทึกรายงานย้อนหลังได้</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={18} color="#ea580c" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#9a3412' }}>รายงานย้อนหลัง — ต้องผ่านการรับรอง</div>
                  <div style={{ fontSize: '0.75rem', color: '#c2410c', marginTop: '2px' }}>
                    วันที่นี้เกิน 3 วันที่ผ่านมา กรุณาส่งคำขออนุมัติก่อน
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Labor ─── */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '12px' : 0, marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
              <Users size={20} color="#3b82f6" /> การจัดการคนงาน (Labor)
            </h3>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '8px', alignItems: isMobile ? 'stretch' : 'center' }}>
              {isPhExistingReport && !isPhEditingExisting && (
                <button
                  onClick={() => setIsPhEditingExisting(true)}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #6366f1', background: '#fff', color: '#6366f1', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
                >
                  <Edit2 size={14} /> แก้ไขข้อมูล
                </button>
              )}
              {isPhExistingReport && isPhEditingExisting && (
                <button
                  onClick={() => setIsPhEditingExisting(false)}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #ef4444', background: '#fef2f2', color: '#ef4444', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
                >
                  <XCircle size={14} /> ยกเลิก
                </button>
              )}
              {isPhEditable && (
                <>
                  <button
                    onClick={() => setActiveModal('Internal')}
                    style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={14} /> คนงานบริษัท (Internal)
                  </button>
                  <button
                    onClick={() => setActiveModal('Outsource')}
                    style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={14} /> ทีมงานผู้รับเหมา (Subco)
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Labor table */}
          {isMobile && labor.length > 0 && (
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ChevronRight size={12} /> เลื่อนตารางแนวนอนเพื่อดู OT / การลา
            </div>
          )}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', overflowX: 'auto', pointerEvents: isPhEditable ? 'auto' : 'none', opacity: isPhEditable ? 1 : 0.82 }}>
            {labor.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <Users size={32} color="#cbd5e1" style={{ marginBottom: '10px' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>ยังไม่มีข้อมูลแรงงาน (กรุณากดปุ่มเพิ่มคนงานด้านบน)</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['No.', 'ชื่อแรงงาน', 'กะปกติ', 'OT : เช้า', 'OT : เที่ยง', 'OT : เย็น', 'จัดการ'].map((h, i) => (
                      <th key={h} style={{
                        padding: '12px 10px', fontSize: '0.8rem', fontWeight: 800, color: '#475569',
                        textAlign: i === 0 || i >= 2 ? 'center' : 'left',
                        width: i === 0 ? 50 : i >= 2 ? 110 : undefined,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {labor.map((l, idx) => {
                    const SHIFTS: { key: 'normal' | 'otMorning' | 'otNoon' | 'otEvening'; label: string; color: string }[] = [
                      { key: 'normal', label: '08:00 - 17:00', color: '#2563eb' },
                      { key: 'otMorning', label: '06:00 - 08:00', color: '#10b981' },
                      { key: 'otNoon', label: '12:00 - 13:00', color: '#f59e0b' },
                      { key: 'otEvening', label: '17:00 - 20:00', color: '#6366f1' },
                    ];
                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        {/* No. */}
                        <td style={{ padding: '12px 10px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                        {/* Name */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                              background: l.membership === 'Internal' ? '#eff6ff' : '#f0fdf4',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {l.membership === 'Internal'
                                ? <User size={14} color="#2563eb" />
                                : <HardHat size={14} color="#059669" />}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                                {l.employeeId ? `${l.employeeId} : ` : ''}{l.staffName || l.affiliation}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>
                                {l.membership === 'Internal' ? 'คนงานบริษัท (Internal)' : `ทีมงานผู้รับเหมา (Subco)${l.amount && l.amount > 1 ? ` · ${l.amount} คน` : ''}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        {/* Shift columns */}
                        {SHIFTS.map(s => {
                          const isActive = (l.shifts as any)?.[s.key];
                          const shiftTimeMap: Record<string, string> = {
                            normal: l.shiftTimes?.day || '08:00 - 17:00',
                            otMorning: l.shiftTimes?.otMorning || '06:00 - 08:00',
                            otNoon: l.shiftTimes?.otNoon || '12:00 - 13:00',
                            otEvening: l.shiftTimes?.otEvening || '17:00 - 20:00',
                          };
                          const rangeStr = shiftTimeMap[s.key];
                          return (
                            <td key={s.key} style={{ padding: '12px 10px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <div
                                  onClick={() => togglePhShift(l.id, s.key)}
                                  style={{
                                    width: 18, height: 18, borderRadius: 4, cursor: 'pointer',
                                    border: `2px solid ${s.color}`,
                                    background: isActive ? s.color : '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  {isActive && <CheckCircle2 size={12} color="#fff" />}
                                </div>
                                {isActive && (
                                  l.membership === 'Internal'
                                    ? renderPhTimeInput(l.id, s.key === 'normal' ? 'normal' : s.key, rangeStr)
                                    : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '2px 5px', fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>
                                        <Clock size={10} />{rangeStr}
                                      </div>
                                    )
                                )}
                              </div>
                            </td>
                          );
                        })}
                        {/* Delete */}
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          <button
                            onClick={() => setLabor(prev => prev.filter(e => e.id !== l.id))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>


        {/* ─── Progress + Photos grid (matching AfterSale layout) ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, 'minmax(260px, 1.2fr) 2.8fr'), gap: '2rem', marginBottom: '16px', alignItems: 'start' }}>

          {/* Progress left */}
          <div style={{ pointerEvents: isPhEditable ? 'auto' : 'none', opacity: isPhEditable ? 1 : 0.82 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} color="#10b981" /> ความคืบหน้า
            </h3>
            <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="range"
                    min="0" max="100" step={5} value={progress}
                    onChange={e => {
                      const val = Number(e.target.value);
                      const allowedMin = phProgressBounds.min > 0 ? phProgressBounds.min + 1 : 0;
                      setProgress(Math.min(phProgressBounds.max, Math.max(allowedMin, val)));
                    }}
                    style={{
                      width: '100%', height: '10px', borderRadius: '6px', appearance: 'none',
                      background: `linear-gradient(to right, #475569 0%, #475569 ${phProgressBounds.min}%, #0d9488 ${phProgressBounds.min}%, #0d9488 ${progress}%, #e2e8f0 ${progress}%, #e2e8f0 100%)`,
                      cursor: 'pointer', outline: 'none', transition: 'all 0.2s',
                    }}
                  />
                </div>
                <div style={{ position: 'relative', width: '100px' }}>
                  <input
                    type="number" min="0" max="100" value={progress}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10);
                      if (isNaN(val)) setProgress(0);
                      else setProgress(Math.min(100, Math.max(0, val)));
                    }}
                    onBlur={() => setProgress(Math.min(phProgressBounds.max, Math.max(phProgressBounds.min, progress)))}
                    style={{
                      width: '100%', padding: '8px 28px 8px 12px', borderRadius: '10px',
                      border: '1px solid #3b82f6', fontSize: '1rem', fontWeight: 900,
                      color: '#1e40af', textAlign: 'center', outline: 'none',
                      boxShadow: '0 2px 4px rgba(59,130,246,0.1)', boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ position: 'absolute', right: '10px', top: '51%', transform: 'translateY(-50%)', fontSize: '0.8rem', fontWeight: 800, color: '#3b82f6' }}>%</span>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '1rem' }}>
                {(() => {
                  if (isPhExistingReport && !isPhEditingExisting)
                    return `* รายงานนี้ถูกบันทึกไว้แล้วที่ ${progress}%`;
                  if (phProgressBounds.isToday)
                    return `* ความคืบหน้าปัจจุบันต้องระบุมากกว่า ${phProgressBounds.min}%`;
                  const rangeMin = phProgressBounds.min > 0 ? phProgressBounds.min + 1 : 0;
                  return `* สำหรับวันที่เลือก ต้องระบุระหว่าง ${rangeMin}% ถึง ${phProgressBounds.max}%`;
                })()}
              </div>
              {isPhEditable && progress > 0 && phProgressBounds.min === 0 && (
                <button onClick={() => setProgress(0)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', marginBottom: '0.5rem' }}>
                  ล้างค่า
                </button>
              )}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[0, 25, 50, 75, 100].map(v => {
                  const isLocked = (phProgressBounds.min > 0 ? v <= phProgressBounds.min : v < phProgressBounds.min) || v > phProgressBounds.max;
                  return (
                  <button key={v} onClick={() => { if (!isLocked) setProgress(v); }} disabled={isLocked}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                      border: '1px solid', cursor: isLocked ? 'not-allowed' : 'pointer',
                      borderColor: progress === v ? '#0d9488' : isLocked ? '#e2e8f0' : '#cbd5e1',
                      background: progress === v ? '#0d9488' : isLocked ? '#f1f5f9' : '#fff',
                      color: progress === v ? '#fff' : isLocked ? '#b0b8c4' : '#475569',
                      opacity: isLocked ? 0.5 : 1,
                      transition: 'all 0.15s',
                    }}>
                    {v === 100 ? 'เสร็จสิ้น' : `${v}%`}
                  </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Photos right — moved here from below */}
          <div style={{ pointerEvents: isPhEditable ? 'auto' : 'none', opacity: isPhEditable ? 1 : 0.82 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={18} color="#f59e0b" /> รูปถ่ายรายงานผล
            </h3>
            <>
              {/* Tab cards */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {photoTabs.map(tab => {
                  const isComplete = tab.current >= tab.required;
                  const isActive = activePhotoTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActivePhotoTab(tab.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', borderRadius: '14px', border: '2px solid',
                        borderColor: isActive ? (isComplete ? '#059669' : '#334155') : (isComplete ? '#10b981' : '#cbd5e1'),
                        background: isActive ? (isComplete ? '#d1fae5' : '#f1f5f9') : (isComplete ? '#ecfdf5' : '#fff'),
                        color: isComplete ? '#059669' : '#475569',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                        transform: isActive ? 'scale(1.02)' : 'scale(1)',
                        boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                        minWidth: '130px',
                      }}
                    >
                      <span style={{ flexShrink: 0 }}>
                        {isComplete ? <CheckCircle2 size={18} color="#059669" /> : <Camera size={18} color="#94a3b8" />}
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, lineHeight: 1.2 }}>{tab.label}</span>
                        <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: isComplete ? '#059669' : '#94a3b8', marginTop: '2px' }}>
                          แนบแล้ว {tab.current}/{tab.required} รูป
                        </span>
                      </span>
                      <ChevronRight size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
              {/* Photo slot area */}
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', minHeight: '160px' }}>
                {activePhotoTab === 'site' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start' }}>
                    {sitePhotos.map((p, i) => (
                      <div key={i} style={{ position: 'relative', width: 110, height: 110, borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                        <img
                          src={typeof p === 'string' ? p : (p instanceof File ? URL.createObjectURL(p) : undefined)}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() => setZoomImage(typeof p === 'string' ? p : (p instanceof File ? URL.createObjectURL(p) : null))}
                          alt=""
                        />
                        <button onClick={() => handleRemoveSlotPhoto('site', i)}
                          style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                    <label style={{ width: 110, height: 110, border: '2px dashed #3b82f6', borderRadius: 14, background: '#eff6ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', cursor: isUploading ? 'not-allowed' : 'pointer', gap: '6px', opacity: isUploading ? 0.6 : 1 }}>
                      <Camera size={22} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>แนบรูป</span>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleSlotPhotoUpload('site', sitePhotos.length, e)} disabled={isUploading} />
                    </label>
                    {sitePhotos.length === 0 && (
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, padding: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#ef4444' }}>⚠</span> ยังไม่มีรูปภาพหน้างาน — กรุณาแนบอย่างน้อย 2 รูป
                      </div>
                    )}
                  </div>
                )}
                {(['regular', 'otMorning', 'otNoon', 'otEvening'] as const).map(shiftKey => {
                  if (activePhotoTab !== shiftKey) return null;
                  const slotLabels = getSlotLabels(shiftKey);
                  const shiftPhotos = photoMap[shiftKey] || [];
                  return (
                    <div key={shiftKey} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      {slotLabels.map((slotLabel, slotIdx) => {
                        const photoUrl = shiftPhotos[slotIdx];
                        const allowed = isSlotTimeAllowed(shiftKey, slotIdx);
                        return (
                          <div key={slotIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            {photoUrl ? (
                              <div style={{ position: 'relative', width: 120, height: 120, borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                                <img
                                  src={typeof photoUrl === 'string' ? photoUrl : (photoUrl instanceof File ? URL.createObjectURL(photoUrl) : undefined)}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                  onClick={() => setZoomImage(typeof photoUrl === 'string' ? photoUrl : (photoUrl instanceof File ? URL.createObjectURL(photoUrl) : null))}
                                  alt={slotLabel}
                                />
                                <button onClick={() => handleRemoveSlotPhoto(shiftKey, slotIdx)}
                                  style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            ) : allowed ? (
                              <label style={{ width: 120, height: 120, border: '2px dashed #cbd5e1', borderRadius: 14, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', cursor: isUploading ? 'not-allowed' : 'pointer', gap: '6px', opacity: isUploading ? 0.6 : 1 }}>
                                <Camera size={22} />
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, textAlign: 'center' }}>แนบรูป</span>
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleSlotPhotoUpload(shiftKey, slotIdx, e)} disabled={isUploading} />
                              </label>
                            ) : (
                              <div style={{ width: 120, height: 120, border: '1px dashed #e2e8f0', borderRadius: 14, background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', gap: '4px' }}>
                                <span style={{ fontSize: '1.2rem' }}>🔒</span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>ยังไม่ถึงเวลา</span>
                              </div>
                            )}
                            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: photoUrl ? '#059669' : '#475569', background: photoUrl ? '#d1fae5' : '#f1f5f9', padding: '3px 12px', borderRadius: '6px', border: `1px solid ${photoUrl ? '#6ee7b7' : '#e2e8f0'}` }}>
                              {photoUrl ? '✓ ' : ''}{slotLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          </div>
        </div>

        {/* ─── Notes ─── */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '12px' : 0, justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ ...sectionTitleStyle, marginBottom: 0 }}>
              <FileText size={16} color="#64748b" /> หมายเหตุ (Site Notes)
            </div>
            <div
              onClick={() => setPhReportType(prev => prev === 'Problem' ? 'Normal' : 'Problem')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 16px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                background: phReportType === 'Problem' ? '#fef2f2' : '#f8fafc',
                border: phReportType === 'Problem' ? '1px solid #ef4444' : '1px solid #e2e8f0',
              }}
            >
              <div style={{
                width: '40px', height: '22px',
                background: phReportType === 'Problem' ? '#ef4444' : '#cbd5e1',
                borderRadius: '20px', position: 'relative', transition: 'all 0.3s',
              }}>
                <div style={{
                  width: '16px', height: '16px', background: '#fff', borderRadius: '50%',
                  position: 'absolute', top: '3px',
                  left: phReportType === 'Problem' ? '21px' : '3px',
                  transition: 'all 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <span style={{
                fontSize: '0.85rem', fontWeight: 800,
                color: phReportType === 'Problem' ? '#ef4444' : '#64748b',
              }}>
                {phReportType === 'Problem' ? '🚨 พบปัญหาหน้างาน' : 'สถานะปกติ'}
              </span>
            </div>
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={phReportType === 'Problem' ? 'ระบุรายละเอียดปัญหาที่พบ...' : 'ระบุรายละเอียดเพิ่มเติม...'}
            rows={3}
            readOnly={!isPhEditable}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px', outline: 'none',
              boxSizing: 'border-box', fontFamily: 'inherit', color: '#334155',
              fontSize: '0.85rem', resize: 'vertical', transition: 'all 0.2s',
              border: phReportType === 'Problem' ? '2px solid #ef4444' : '1px solid #e2e8f0',
              background: phReportType === 'Problem' ? '#fff' : '#f8fafc',
              opacity: isPhEditable ? 1 : 0.82,
            }}
          />
        </div>

        {/* ─── History ─── */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{
            fontSize: '1.05rem', fontWeight: 900, color: '#0f172a',
            margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <Activity size={18} color="#6366f1" /> ประวัติการปฏิบัติงาน (Work History)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {phDailyHistory.length === 0 ? (
              <div style={{ ...sectionStyle, textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 700 }}>
                ยังไม่มีประวัติการทำงาน
              </div>
            ) : [...phDailyHistory].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')).map((h: any) => {
              const hDateStr: string = h.date?.split('T')[0] || '';
              const isSelected = hDateStr === reportDate;
              const totalManpower = (h.labor || []).reduce((acc: number, l: any) => acc + (Number(l.amount) || 1), 0);
              const shiftRange: string = (h.labor || []).find((l: any) => l.shiftTimes?.day)?.shiftTimes?.day || '';
              const allPhotos: string[] = [
                ...(h.sitePhotos || []),
                ...(h.laborPhotos?.regular || []),
                ...(h.laborPhotos?.otMorning || []),
                ...(h.laborPhotos?.otNoon || []),
                ...(h.laborPhotos?.otEvening || []),
              ].filter(Boolean);
              const histKey = h.id || hDateStr;
              const isPhotosExpanded = expandedHistoryPhotos.has(histKey);
              const isProblem = h.noteType === 'Problem';
              return (
                <div
                  key={h.id}
                  onClick={() => setReportDate(hDateStr)}
                  style={{
                    padding: '16px', borderRadius: '16px', cursor: 'pointer',
                    background: isSelected ? '#eff6ff' : '#fff',
                    border: `2px solid ${isSelected ? '#3b82f6' : isProblem ? '#fecaca' : '#e2e8f0'}`,
                    boxShadow: isSelected ? '0 4px 12px rgba(59,130,246,0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
                    transform: isSelected ? 'translateY(-2px)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Row 1: date + progress + shift time */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#1e293b' }}>
                      {hDateStr ? new Date(hDateStr).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      {shiftRange && (
                        <span style={{ fontSize: '0.68rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '2px 7px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={9} />{shiftRange}
                        </span>
                      )}
                      <span style={{ fontSize: '0.72rem', color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        {h.progress}%
                      </span>
                      {isProblem && (
                        <span style={{ fontSize: '0.68rem', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', padding: '2px 7px', fontWeight: 700 }}>
                          🚨 ปัญหา
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: worker tags */}
                  {(h.labor || []).length > 0 && (
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>👷 {totalManpower} คน</span>
                      {(h.labor || []).map((l: any, idx: number) => (
                        <span key={idx} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                          fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '8px',
                          background: l.membership === 'Internal' ? '#eff6ff' : '#f0fdf4',
                          color: l.membership === 'Internal' ? '#2563eb' : '#059669',
                          border: `1px solid ${l.membership === 'Internal' ? '#bfdbfe' : '#bbf7d0'}`,
                        }}>
                          {l.membership === 'Internal' ? <User size={9} /> : <HardHat size={9} />}
                          {l.staffName || l.affiliation}
                          {l.amount && l.amount > 1 ? ` ×${l.amount}` : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Row 3: note */}
                  {h.note && (
                    <div style={{ fontSize: '0.75rem', color: isProblem ? '#ef4444' : '#475569', background: isProblem ? '#fef2f2' : '#f8fafc', border: `1px solid ${isProblem ? '#fecaca' : '#e2e8f0'}`, borderRadius: '8px', padding: '6px 10px', marginBottom: '8px', fontWeight: 600 }}>
                      {isProblem ? '🚨 ' : '📝 '}{h.note.substring(0, 60)}{h.note.length > 60 ? '…' : ''}
                    </div>
                  )}

                  {/* Row 4: photo accordion */}
                  {allPhotos.length > 0 && (
                    <div>
                      <div
                        onClick={e => { e.stopPropagation(); toggleHistoryPhotos(histKey); }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                          fontSize: '0.72rem', fontWeight: 700, color: '#0d9488',
                          background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '8px',
                          padding: '3px 10px', marginBottom: isPhotosExpanded ? '8px' : '0',
                          transition: 'all 0.15s',
                        }}
                      >
                        <Camera size={11} /> รูปถ่าย ({allPhotos.length} รูป) {isPhotosExpanded ? '▲' : '▼'}
                      </div>
                      {isPhotosExpanded && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {allPhotos.map((url, pi) => (
                            <img
                              key={pi}
                              src={url}
                              alt=""
                              onClick={e => { e.stopPropagation(); setZoomImage(url); }}
                              style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: '8px', cursor: 'zoom-in', border: '1px solid #e2e8f0' }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Row 5: submitted by */}
                  {h.submittedBy && (
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '6px', fontWeight: 600 }}>
                      บันทึกโดย {h.submittedBy} · {h.submittedAt ? new Date(h.submittedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ─── Footer ─── */}
      <div style={{
        padding: '16px 24px', background: '#fff', borderTop: '1px solid #e2e8f0',
        display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px',
        justifyContent: isMobile ? 'flex-start' : 'flex-end',
        alignItems: 'stretch', flexShrink: 0,
      }}>
        <button
          onClick={() => selectPhCatInfo(null)}
          style={{
            padding: '10px 20px', background: '#f1f5f9', color: '#475569',
            border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          ปิด
        </button>
        {isPhReportDatePast3Days && !isPhExistingReport ? (
          <button
            onClick={submitPhRetroactiveRequest}
            disabled={phRetroactiveSubmitDone || isSubmitting}
            style={{
              padding: '12px 28px', borderRadius: '14px',
              background: phRetroactiveSubmitDone ? '#d1fae5' : '#ea580c',
              color: phRetroactiveSubmitDone ? '#15803d' : '#fff',
              border: 'none', fontWeight: 900,
              cursor: (phRetroactiveSubmitDone || isSubmitting) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              whiteSpace: 'nowrap',
              boxShadow: phRetroactiveSubmitDone ? 'none' : '0 4px 6px rgba(234,88,12,0.25)',
            }}
          >
            {(isSubmitting) && <Loader2 className="animate-spin" size={20} />}
            {phRetroactiveSubmitDone ? 'ส่งคำขอแล้ว' : 'ส่งขอรับรอง'}
          </button>
        ) : isPhEditable ? (
          <>
            <button
              onClick={savePhDraft}
              disabled={isSubmitting || isUploading}
              style={{
                padding: '12px 24px',
                borderRadius: '14px',
                border: '1.5px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontWeight: 900,
                cursor: isSubmitting || isUploading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { if (!isSubmitting && !isUploading) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
              onMouseLeave={(e) => { if (!isSubmitting && !isUploading) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#cbd5e1'; } }}
            >
              บันทึกแบบร่าง
            </button>
            <button
              onClick={() => setShowPhSummaryModal(true)}
              disabled={isSubmitting || isUploading}
              style={{
                padding: '12px 32px',
                borderRadius: '14px',
                border: 'none',
                background: isSubmitting || isUploading ? '#94a3b8' : '#0d9488',
                color: '#fff',
                fontWeight: 900,
                cursor: isSubmitting || isUploading ? 'not-allowed' : 'pointer',
                boxShadow: isSubmitting || isUploading ? 'none' : '0 4px 6px rgba(13,148,136,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                whiteSpace: 'nowrap',
              }}
            >
              {isPhEditingExisting ? 'ยืนยันการแก้ไขรายงาน' : 'ยืนยันการส่งรายงาน'}
            </button>
          </>
        ) : null}
      </div>

      {/* PreHandover Summary Modal */}
      <PreHandoverSummaryModal />

      {/* Zoom overlay */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <img src={zoomImage} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }} alt="" />
        </div>
      )}
    </div>
  );
};
