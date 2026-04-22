import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { ActivityLog } from '../types';
import { Search, Calendar, User, Shield, Activity as ActionIcon, ChevronLeft, ChevronRight } from 'lucide-react';

const ActivityLogTable = () => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedAction, setSelectedAction] = useState('');

    // Get local date string YYYY-MM-DD
    const getLocalDateString = (date: Date) => {
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().split('T')[0];
    };

    const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()));

    const changeDay = (delta: number) => {
        const current = new Date(selectedDate || new Date());
        current.setDate(current.getDate() + delta);
        setSelectedDate(getLocalDateString(current));
    };

    useEffect(() => {
        setLoading(true);

        // Calculate start and end of the selected day in UTC, but matching local date YYYY-MM-DD
        // Example: For 2026-02-25 ICT, we need logs from 2026-02-24 17:00:00 UTC to 2026-02-25 16:59:59 UTC
        let startOfDay: Date;
        let endOfDay: Date;

        if (selectedDate) {
            startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);

            endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);
        } else {
            // Default to today if no date selected
            startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
        }

        const q = query(
            collection(db, 'activity_logs'),
            where('timestamp', '>=', startOfDay),
            where('timestamp', '<=', endOfDay),
            orderBy('timestamp', 'desc'),
            limit(500) // Increase limit as it's now per day
        );

        const unsub = onSnapshot(q, (snap) => {
            setLogs(snap.docs.map(d => ({ ...d.data(), id: d.id }) as ActivityLog));
            setLoading(false);
        }, (error) => {
            console.error("Firestore Subscribe Error:", error);
            setLoading(false);
        });

        return () => unsub();
    }, [selectedDate]); // Re-run when date changes

    const filteredLogs = logs.filter((log: ActivityLog) => {
        const matchesSearch = log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.details?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = !selectedRole || log.role === selectedRole;
        const matchesAction = !selectedAction || log.action === selectedAction;

        // matchesDate is now handled by the server query
        return matchesSearch && matchesRole && matchesAction;
    });

    const formatTimestamp = (ts: any) => {
        if (!ts) return (
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>
                กำลังบันทึก...
            </span>
        );
        const date = ts.toDate();
        return date.toLocaleString('th-TH', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const commonInputStyle = {
        padding: '10px 16px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        fontSize: '0.9rem',
        fontWeight: 600,
        outline: 'none',
        background: '#fff'
    };

    return (
        <div style={{ padding: '0px' }}>
            {/* Filter Bar */}
            <div style={{ padding: '24px 32px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                    <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อผู้ใช้ หรือ รายละเอียด..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ ...commonInputStyle, width: '100%', paddingLeft: '44px', boxSizing: 'border-box' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <button
                            onClick={() => changeDay(-1)}
                            style={{ padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', color: '#64748b', transition: 'background 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseOut={e => e.currentTarget.style.background = 'none'}
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <div style={{ position: 'relative', borderLeft: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                            <Calendar style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} size={16} />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{ ...commonInputStyle, border: 'none', paddingLeft: '38px', borderRadius: 0 }}
                            />
                        </div>

                        <button
                            onClick={() => changeDay(1)}
                            disabled={selectedDate === new Date().toISOString().split('T')[0]}
                            style={{ padding: '8px 12px', border: 'none', background: 'none', cursor: selectedDate === new Date().toISOString().split('T')[0] ? 'not-allowed' : 'pointer', display: 'flex', color: selectedDate === new Date().toISOString().split('T')[0] ? '#cbd5e1' : '#64748b' }}
                            onMouseOver={e => !e.currentTarget.disabled && (e.currentTarget.style.background = '#f1f5f9')}
                            onMouseOut={e => e.currentTarget.style.background = 'none'}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <select
                        style={commonInputStyle}
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                    >
                        <option value="">ทุกตำแหน่ง (Roles)</option>
                        <option value="Admin">Admin</option>
                        <option value="Foreman">Foreman</option>
                        <option value="BackOffice">BackOffice</option>
                        <option value="Approver">Approver</option>
                    </select>

                    <select
                        style={commonInputStyle}
                        value={selectedAction}
                        onChange={(e) => setSelectedAction(e.target.value)}
                    >
                        <option value="">ทุกกิจกรรม (Actions)</option>
                        <option value="LOGIN">LOGIN</option>
                        <option value="CREATE">CREATE</option>
                        <option value="UPDATE">UPDATE</option>
                        <option value="DELETE">DELETE</option>
                        <option value="UPLOAD">UPLOAD</option>
                        <option value="VIEW_PAGE">VIEW_PAGE</option>
                        <option value="APPROVE">APPROVE</option>
                    </select>
                </div>
            </div>

            {/* Table Area */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', background: '#ffffff', color: '#64748b', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #f1f5f9' }}>
                            <th style={{ padding: '16px 32px' }}>วัน-เวลา</th>
                            <th style={{ padding: '16px 32px' }}>ผู้ใช้งาน</th>
                            <th style={{ padding: '16px 32px' }}>สังกัด/ตำแหน่ง</th>
                            <th style={{ padding: '16px 32px' }}>กิจกรรม</th>
                            <th style={{ padding: '16px 32px' }}>รายละเอียด</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>กำลังดึงข้อมูล Log...</td>
                            </tr>
                        ) : filteredLogs.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>ไม่พบประวัติการใช้งานตามเงื่อนไขที่เลือก</td>
                            </tr>
                        ) : (
                            filteredLogs.map((log: ActivityLog) => (
                                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '20px 32px', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                                        {formatTimestamp(log.timestamp)}
                                    </td>
                                    <td style={{ padding: '20px 32px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: '#1e293b' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                <User size={16} />
                                            </div>
                                            {log.userName}
                                        </div>
                                    </td>
                                    <td style={{ padding: '20px 32px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Shield size={14} color="#94a3b8" />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>{log.role}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '20px 32px' }}>
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800,
                                            background: log.action === 'CREATE' ? '#dcfce7' : log.action === 'DELETE' ? '#fee2e2' : log.action === 'UPDATE' ? '#e0e7ff' : '#f1f5f9',
                                            color: log.action === 'CREATE' ? '#15803d' : log.action === 'DELETE' ? '#b91c1c' : log.action === 'UPDATE' ? '#4338ca' : '#475569',
                                            display: 'inline-flex', alignItems: 'center', gap: '6px'
                                        }}>
                                            <ActionIcon size={12} />
                                            {log.action}
                                        </span>
                                    </td>
                                    <td style={{ padding: '20px 32px', color: '#334155', fontSize: '0.9rem', fontWeight: 500, maxWidth: '400px' }}>
                                        {log.details}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Summary Footer */}
            <div style={{ padding: '20px 32px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.85rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>แสดงรายการสำหรับวันที่ {selectedDate ? new Date(selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'} ({filteredLogs.length} รายการ )</div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>* ระบบเก็บข้อมูลย้อนหลัง 6 เดือน และอัปเดตแบบ Real-time</div>
            </div>
        </div>
    );
};

export default ActivityLogTable;
