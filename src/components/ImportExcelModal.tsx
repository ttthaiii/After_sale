import { useState, useRef } from 'react';
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ModalCloseButton } from './ui/ModalCloseButton';

export type ImportType = 'Staff' | 'Contractors';

export interface ImportOutcome {
    success: number;
    failed: { label: string; reason: string }[];
}

interface RowError { row: number; reason: string }

interface ParsedResult {
    valid: any[];
    errors: RowError[];
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    type: ImportType;
    // Keys of records that already exist (Staff: employeeId; Contractors: lowercased name)
    // -> used to mark each preview row as "update" vs "new".
    existingKeys?: Set<string>;
    // Parent performs the actual Firestore writes (+ Labor sync for Staff).
    onConfirm: (rows: any[]) => Promise<ImportOutcome>;
}

// Dedup key of a validated row (matches parent's upsert key).
const keyOf = (type: ImportType, row: any): string =>
    type === 'Staff'
        ? String(row.employeeId ?? '').trim()
        : String(row.name ?? '').trim().toLowerCase();

const VALID_ROLES = ['Admin', 'Foreman', 'Manager', 'Approver'];

const TEMPLATE_URL: Record<ImportType, string> = {
    Staff: '/templates/staff_import_template.xlsx',
    Contractors: '/templates/contractor_import_template.xlsx',
};

const TITLE: Record<ImportType, string> = {
    Staff: 'นำเข้าเจ้าหน้าที่จาก Excel',
    Contractors: 'นำเข้าผู้รับเหมาจาก Excel',
};

const splitList = (v: any): string[] =>
    String(v ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

// Validate one raw row (keys = template headers). Returns data or an error reason.
const validateRow = (type: ImportType, raw: any): { data?: any; error?: string } => {
    if (type === 'Staff') {
        const employeeId = String(raw.employeeId ?? '').trim();
        const name = String(raw.name ?? '').trim();
        const role = String(raw.role ?? '').trim();
        if (!employeeId) return { error: 'ไม่มี employeeId' };
        if (!name) return { error: 'ไม่มีชื่อ (name)' };
        if (!role) return { error: 'ไม่มีตำแหน่ง (role)' };
        if (!VALID_ROLES.includes(role))
            return { error: `role "${role}" ไม่ถูกต้อง (ต้องเป็น Admin/Foreman/Manager/Approver)` };
        return {
            data: {
                employeeId,
                name,
                username: String(raw.username ?? '').trim(),
                password: String(raw.password ?? '').trim(),
                role,
                assignedProjects: splitList(raw.assignedProjects),
            },
        };
    }
    // Contractors
    const name = String(raw.name ?? '').trim();
    if (!name) return { error: 'ไม่มีชื่อ (name)' };
    return {
        data: {
            name,
            specialty: splitList(raw.specialty),
            phone: String(raw.phone ?? '').trim(),
        },
    };
};

const ImportExcelModal = ({ isOpen, onClose, type, existingKeys, onConfirm }: Props) => {
    const [fileName, setFileName] = useState('');
    const [parsed, setParsed] = useState<ParsedResult | null>(null);
    const [parseError, setParseError] = useState('');
    const [importing, setImporting] = useState(false);
    const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const reset = () => {
        setFileName('');
        setParsed(null);
        setParseError('');
        setImporting(false);
        setOutcome(null);
    };

    const close = () => {
        reset();
        onClose();
    };

    const handleFile = async (file: File) => {
        reset();
        setFileName(file.name);
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: 'array' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

            const valid: any[] = [];
            const errors: RowError[] = [];
            rows.forEach((raw, i) => {
                // skip fully-empty rows
                const isEmpty = Object.values(raw).every((v) => String(v ?? '').trim() === '');
                if (isEmpty) return;
                const { data, error } = validateRow(type, raw);
                if (error) errors.push({ row: i + 2, reason: error }); // +2: header row + 1-index
                else valid.push(data);
            });
            setParsed({ valid, errors });
        } catch (err: any) {
            console.error('Excel parse failed:', err);
            setParseError('อ่านไฟล์ไม่สำเร็จ กรุณาตรวจว่าเป็นไฟล์ Excel (.xlsx) ที่ถูกต้อง');
        }
    };

    const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
    };

    const handleConfirm = async () => {
        if (!parsed || parsed.valid.length === 0) return;
        setImporting(true);
        try {
            const result = await onConfirm(parsed.valid);
            setOutcome(result);
        } catch (err: any) {
            console.error('Import failed:', err);
            setOutcome({ success: 0, failed: [{ label: 'ทั้งหมด', reason: err?.message || 'เกิดข้อผิดพลาด' }] });
        } finally {
            setImporting(false);
        }
    };

    const box: React.CSSProperties = {
        background: '#fff', borderRadius: '24px', width: '560px', maxWidth: '92%',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.15)', overflow: 'hidden',
    };
    const stepLabel: React.CSSProperties = { fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
        }}>
            <div style={box}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#ecfdf5', color: '#059669', padding: '10px', borderRadius: '12px', display: 'flex' }}>
                            <FileSpreadsheet size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{TITLE[type]}</h3>
                    </div>
                    <ModalCloseButton onClick={close} size={24} />
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    {/* Done summary */}
                    {outcome ? (
                        <div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '16px 0' }}>
                                <CheckCircle2 size={48} color="#10b981" />
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>นำเข้าสำเร็จ {outcome.success} รายการ</div>
                            </div>
                            {outcome.failed.length > 0 && (
                                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px', marginTop: '8px' }}>
                                    <div style={{ fontWeight: 800, color: '#b91c1c', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <AlertTriangle size={16} /> นำเข้าไม่สำเร็จ {outcome.failed.length} รายการ
                                    </div>
                                    {outcome.failed.map((f, i) => (
                                        <div key={i} style={{ fontSize: '0.85rem', color: '#7f1d1d' }}>• {f.label}: {f.reason}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Step 1: download template */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={stepLabel}>ขั้นที่ 1 · ดาวน์โหลด Template แล้วกรอกข้อมูล</div>
                                <a
                                    href={TEMPLATE_URL[type]}
                                    download
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', background: '#eef2ff', color: '#4f46e5', fontWeight: 700, textDecoration: 'none', border: '1px solid #c7d2fe' }}
                                >
                                    <Download size={18} /> ดาวน์โหลด Template
                                </a>
                            </div>

                            {/* Step 2: upload */}
                            <div style={stepLabel}>ขั้นที่ 2 · อัปโหลดไฟล์ที่กรอกแล้ว</div>
                            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFileInput} />
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={onDrop}
                                style={{ border: '2px dashed #cbd5e1', borderRadius: '14px', padding: '28px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}
                            >
                                <Upload size={28} color="#4f46e5" style={{ margin: '0 auto 8px' }} />
                                <div style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 700 }}>
                                    {fileName || 'คลิกเพื่อเลือกไฟล์ หรือ ลากไฟล์มาวางที่นี่'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>รองรับไฟล์ .xlsx</div>
                            </div>

                            {parseError && (
                                <div style={{ marginTop: '12px', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 700 }}>{parseError}</div>
                            )}

                            {/* Preview */}
                            {parsed && (() => {
                                const rows = parsed.valid.map((r) => ({
                                    r,
                                    isUpdate: !!existingKeys?.has(keyOf(type, r)),
                                }));
                                const updateCount = rows.filter((x) => x.isUpdate).length;
                                const newCount = rows.length - updateCount;
                                const badge = (isUpdate: boolean) => (
                                    <span style={{
                                        fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px',
                                        background: isUpdate ? '#fef3c7' : '#dcfce7',
                                        color: isUpdate ? '#b45309' : '#15803d',
                                    }}>{isUpdate ? 'อัปเดตทับ' : 'เพิ่มใหม่'}</span>
                                );
                                const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: '0.72rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc' };
                                const td: React.CSSProperties = { padding: '8px 10px', fontSize: '0.82rem', color: '#334155', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' };
                                return (
                                <div style={{ marginTop: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 800, fontSize: '0.95rem' }}>
                                        <CheckCircle2 size={18} /> พร้อมนำเข้า {parsed.valid.length} รายการ
                                    </div>
                                    {/* count summary */}
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                                        <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: '10px', padding: '8px 14px', fontWeight: 800, fontSize: '0.85rem' }}>เพิ่มใหม่ {newCount} รายการ</div>
                                        <div style={{ background: '#fef3c7', color: '#b45309', borderRadius: '10px', padding: '8px 14px', fontWeight: 800, fontSize: '0.85rem' }}>อัปเดตทับข้อมูลเดิม {updateCount} รายการ</div>
                                    </div>
                                    {/* preview table */}
                                    {rows.length > 0 && (
                                        <div style={{ marginTop: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                            <div style={{ maxHeight: '220px', overflow: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={th}>#</th>
                                                            {type === 'Staff' ? (
                                                                <>
                                                                    <th style={th}>รหัส</th>
                                                                    <th style={th}>ชื่อ</th>
                                                                    <th style={th}>ตำแหน่ง</th>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <th style={th}>ชื่อ</th>
                                                                    <th style={th}>ความชำนาญ</th>
                                                                    <th style={th}>เบอร์โทร</th>
                                                                </>
                                                            )}
                                                            <th style={th}>สถานะ</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {rows.map(({ r, isUpdate }, i) => (
                                                            <tr key={i}>
                                                                <td style={td}>{i + 1}</td>
                                                                {type === 'Staff' ? (
                                                                    <>
                                                                        <td style={td}>{r.employeeId}</td>
                                                                        <td style={td}>{r.name}</td>
                                                                        <td style={td}>{r.role}</td>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <td style={td}>{r.name}</td>
                                                                        <td style={td}>{(r.specialty || []).join(', ') || '-'}</td>
                                                                        <td style={td}>{r.phone || '-'}</td>
                                                                    </>
                                                                )}
                                                                <td style={td}>{badge(isUpdate)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                    {parsed.errors.length > 0 && (
                                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px', marginTop: '12px' }}>
                                            <div style={{ fontWeight: 800, color: '#b45309', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <AlertTriangle size={16} /> ข้ามไป {parsed.errors.length} แถว (ข้อมูลไม่ครบ/ไม่ถูกต้อง)
                                            </div>
                                            <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                                                {parsed.errors.map((e, i) => (
                                                    <div key={i} style={{ fontSize: '0.85rem', color: '#92400e' }}>• แถว {e.row}: {e.reason}</div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                );
                            })()}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '20px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button onClick={close} style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>
                        {outcome ? 'ปิด' : 'ยกเลิก'}
                    </button>
                    {!outcome && (
                        <button
                            onClick={handleConfirm}
                            disabled={!parsed || parsed.valid.length === 0 || importing}
                            style={{
                                padding: '10px 24px', borderRadius: '12px', border: 'none',
                                background: (!parsed || parsed.valid.length === 0 || importing) ? '#cbd5e1' : '#4f46e5',
                                color: '#fff', fontWeight: 700, cursor: (!parsed || parsed.valid.length === 0 || importing) ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                            }}
                        >
                            {importing && <Loader2 size={16} className="animate-spin" />}
                            {importing ? 'กำลังนำเข้า...' : `ยืนยันนำเข้า${parsed ? ` ${parsed.valid.length} รายการ` : ''}`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportExcelModal;
