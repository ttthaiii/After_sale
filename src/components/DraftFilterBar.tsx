import { draftTimeBucket, BUCKET_META, type DraftBucket } from '../utils/draftSchedule';

// Reusable control bar for a foreman draft zone: a summary strip (total / overdue / soon)
// plus time-filter chips. Both the After-Sale and Pre-Handover zones render this same
// component — the bucket counts and filtering come from the single-source draftTimeBucket().

type FilterValue = DraftBucket | 'all';

// Decoupled prop shape — we only need the planned date to bucket a draft.
interface DraftLike {
    appointmentDate?: string;
}

interface DraftFilterBarProps {
    drafts: DraftLike[];
    value: FilterValue;
    onChange: (v: FilterValue) => void;
    accentColor: string;
    isMobile?: boolean;
}

const CHIPS: { key: FilterValue; label: string }[] = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'overdue', label: BUCKET_META.overdue.label },
    { key: 'soon', label: BUCKET_META.soon.label },
    { key: 'ok', label: BUCKET_META.ok.label },
];

export default function DraftFilterBar({ drafts, value, onChange, accentColor, isMobile = false }: DraftFilterBarProps) {
    const total = drafts.length;
    let overdue = 0;
    let soon = 0;
    for (const d of drafts) {
        const b = draftTimeBucket(d.appointmentDate);
        if (b === 'overdue') overdue++;
        else if (b === 'soon') soon++;
    }

    return (
        <div style={{
            background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '12px',
            padding: isMobile ? '10px 12px' : '12px 14px', marginBottom: '14px',
        }}>
            {/* Summary strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>{total}</span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>งานทั้งหมด</span>
                </div>
                {overdue > 0 && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                        <span style={{ fontSize: '20px', fontWeight: 800, color: BUCKET_META.overdue.color }}>{overdue}</span>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>เกินกำหนด</span>
                    </div>
                )}
                {soon > 0 && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                        <span style={{ fontSize: '20px', fontWeight: 800, color: BUCKET_META.soon.color }}>{soon}</span>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>ใกล้ถึงกำหนด</span>
                    </div>
                )}
            </div>

            {/* Filter chips */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {CHIPS.map(chip => {
                    const active = value === chip.key;
                    return (
                        <button
                            key={chip.key}
                            onClick={(e) => { e.stopPropagation(); onChange(chip.key); }}
                            style={{
                                fontSize: '13px', padding: '5px 12px', borderRadius: '999px', cursor: 'pointer',
                                border: active ? `1px solid ${accentColor}` : '1px solid #e5e7eb',
                                background: active ? accentColor : '#ffffff',
                                color: active ? '#ffffff' : '#4b5563',
                                fontWeight: active ? 700 : 500, transition: 'all 0.15s',
                            }}
                        >
                            {chip.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
