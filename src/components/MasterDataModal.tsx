import { useState, useEffect, useRef } from 'react';
import { X, Upload, User, Building, HardHat, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Staff, Project, Contractor } from '../types';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../utils/imageCompression';
import LoadingOverlay from './LoadingOverlay';

interface MasterDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'Staff' | 'Contractors' | 'Projects';
    initialData?: Staff | Project | Contractor | null;
    projects?: Project[]; // New: Pass projects for selection
    onSave: (data: any) => void;
}

const MasterDataModal = ({ isOpen, onClose, type, initialData, projects = [], onSave }: MasterDataModalProps) => {
    const [formData, setFormData] = useState<any>({});
    const [showStaffPassword, setShowStaffPassword] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialData) {
            const data = { ...initialData };
            // ✅ Auto-fill Employee ID from password if employeeId is missing (Transition support)
            if (type === 'Staff' && !data.employeeId && data.password) {
                data.employeeId = data.password;
            }
            setFormData(data);
        } else {
            // Default empty state based on type
            if (type === 'Staff') setFormData({ name: '', role: 'Foreman', phone: '', affiliation: '', profileImage: '', assignedProjects: '', employeeId: '' });
            else if (type === 'Projects') setFormData({ name: '', code: '', affiliation: '', imageUrl: '' });
            else setFormData({ name: '', specialty: '', phone: '' });
        }
    }, [initialData, type, isOpen]);

    if (!isOpen) return null;

    const handleChange = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `${type.toLowerCase()}_${Date.now()}.${fileExt}`;
            const subPath = type === 'Staff' ? (formData.username || 'new_staff') : type === 'Projects' ? (formData.code || 'new_project') : 'contractors';
            const storagePath = `master_data/${type.toLowerCase()}s/${subPath}/${fileName}`;
            const storageRef = ref(storage, storagePath);

            // 1. บีบอัดรูปภาพ (ลดขนาดไฟล์เพื่อประหยัดเงินและแบนด์วิดท์)
            const compressedFile = await compressImage(file, 800, 0.7);

            // 2. ตั้งค่า Cache Control (ลดจำนวน Request และประหยัดแบนด์วิดท์)
            const metadata = {
                cacheControl: 'public, max-age=31536000', // จำรูปไว้ 1 ปี
                contentType: compressedFile.type || 'image/jpeg',
            };

            const snapshot = await uploadBytes(storageRef, compressedFile, metadata);
            const downloadURL = await getDownloadURL(snapshot.ref);

            if (type === 'Staff') handleChange('profileImage', downloadURL);
            if (type === 'Projects') handleChange('imageUrl', downloadURL);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSave = { ...formData };
            
            // ✅ Synchronize Employee ID and Password for login consistency
            if (type === 'Staff' && dataToSave.employeeId) {
                dataToSave.password = dataToSave.employeeId;
            }

            await onSave(dataToSave);
            onClose();
        } catch (error) {
            console.error('Save failed:', error);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
        }}>
            <LoadingOverlay isVisible={isSubmitting} />
            <div style={{
                background: '#fff', borderRadius: '24px', width: '500px', maxWidth: '90%',
                maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 50px rgba(0,0,0,0.1)', overflow: 'hidden',
                animation: 'scaleIn 0.2s ease-out'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#f8fafc', flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            background: '#eef2ff', color: '#4f46e5', padding: '10px', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {type === 'Staff' ? <User size={20} /> : type === 'Projects' ? <Building size={20} /> : <HardHat size={20} />}
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                            {initialData ? 'แก้ไขข้อมูล' : 'เพิ่มข้อมูล'} {type === 'Staff' ? 'เจ้าหน้าที่' : type === 'Projects' ? 'โครงการ' : 'ผู้รับเหมา'}
                        </h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Image Preview (For Staff & Projects) */}
                        {(type === 'Staff' || type === 'Projects') && (
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                                <div
                                    onClick={() => !isUploading && fileInputRef.current?.click()}
                                    style={{
                                        width: '100px', height: '100px', borderRadius: type === 'Staff' ? '50%' : '16px',
                                        background: '#f1f5f9', border: '2px dashed #cbd5e1',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                        position: 'relative', cursor: isUploading ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s',
                                        opacity: isUploading ? 0.7 : 1
                                    }}
                                >
                                    {isUploading ? (
                                        <Loader2 className="animate-spin" size={24} color="#4f46e5" />
                                    ) : (type === 'Staff' ? formData.profileImage : formData.imageUrl) ? (
                                        <img
                                            src={type === 'Staff' ? formData.profileImage : formData.imageUrl}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => e.currentTarget.style.display = 'none'}
                                        />
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <Upload size={24} color="#4f46e5" />
                                            <span style={{ fontSize: '0.65rem', color: '#4f46e5', fontWeight: 700 }}>อัปโหลด</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Common Fields */}
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>ชื่อ (Name)</label>
                            <input
                                type="text"
                                value={formData.name || ''}
                                onChange={(e) => handleChange('name', e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                placeholder="ระบุชื่อ..."
                                required
                            />
                        </div>

                        {/* Staff Specific */}
                        {type === 'Staff' && (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>ไอดีเข้าระบบ (Username)</label>
                                        <input
                                            type="text"
                                            value={formData.username || ''}
                                            onChange={(e) => handleChange('username', e.target.value)}
                                            style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                            placeholder="User..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>รหัสพนักงาน (Employee ID)</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type={showStaffPassword ? 'text' : 'password'}
                                                value={formData.employeeId || ''}
                                                onChange={(e) => handleChange('employeeId', e.target.value)}
                                                style={{ width: '100%', padding: '10px 42px 10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                                placeholder="เช่น 101527"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowStaffPassword(!showStaffPassword)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '10px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#94a3b8',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '4px'
                                                }}
                                            >
                                                {showStaffPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>ตำแหน่ง (Role)</label>
                                    <select
                                        value={formData.role || 'Foreman'}
                                        onChange={(e) => handleChange('role', e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                    >
                                        <option value="Foreman">Foreman (ผู้ควบคุมงาน)</option>
                                        <option value="Admin">Admin (ผู้ดูแลระบบ)</option>
                                        <option value="Manager">Manager/Approver (ผู้อนุมัติ)</option>
                                        <option value="BackOffice">BackOffice (ธุรการ/คลัง)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4b5563', margin: 0 }}>
                                            โครงการที่รับผิดชอบ (Assigned Projects)
                                        </label>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const allCodes = projects.map(p => p.code);
                                                    handleChange('assignedProjects', allCodes);
                                                }}
                                                style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                            >
                                                เลือกทั้งหมด
                                            </button>
                                            <div style={{ width: '1px', height: '12px', background: '#e2e8f0' }}></div>
                                            <button
                                                type="button"
                                                onClick={() => handleChange('assignedProjects', [])}
                                                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                            >
                                                ล้างทั้งหมด
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{
                                        background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0',
                                        maxHeight: '160px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr', gap: '8px'
                                    }}>
                                        {projects.map(p => (
                                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', color: '#334155', padding: '4px 0' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={(formData.assignedProjects || []).includes(p.code)}
                                                    onChange={(e) => {
                                                        const current = formData.assignedProjects || [];
                                                        if (e.target.checked) handleChange('assignedProjects', [...current, p.code]);
                                                        else handleChange('assignedProjects', current.filter((id: string) => id !== p.code));
                                                    }}
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                />
                                                <span style={{ fontWeight: 700, background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'monospace' }}>{p.id}</span>
                                                {p.name}
                                            </label>
                                        ))}
                                        {projects.length === 0 && <span style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>ไม่มีข้อมูลโครงการ</span>}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>สังกัด (Affiliation)</label>
                                    <input
                                        type="text"
                                        value={formData.affiliation || ''}
                                        onChange={(e) => handleChange('affiliation', e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                        placeholder="เช่น Sammakorn, Life Asset"
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>รูปโปรไฟล์ (Image URL)</label>
                                    <input
                                        type="text"
                                        value={formData.profileImage || ''}
                                        onChange={(e) => handleChange('profileImage', e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                        placeholder="https://..."
                                    />
                                </div>
                            </>
                        )}

                        {/* Project Specific */}
                        {type === 'Projects' && (
                            <>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>ID</label>
                                    <input
                                        type="text"
                                        value={formData.code || ''}
                                        onChange={(e) => handleChange('code', e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                        placeholder="e.g. PRJ-001"
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>รูปโครงการ (Image URL)</label>
                                    <input
                                        type="text"
                                        value={formData.imageUrl || ''}
                                        onChange={(e) => handleChange('imageUrl', e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                        placeholder="https://..."
                                    />
                                </div>
                            </>
                        )}

                        {/* Contractor Specific */}
                        {type === 'Contractors' && (
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>ความเชี่ยวชาญ (Specialty)</label>
                                <input
                                    type="text"
                                    value={formData.specialty || ''}
                                    onChange={(e) => handleChange('specialty', e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                    placeholder="เช่น งานไฟฟ้า, งานประปา"
                                />
                            </div>
                        )}

                        {/* Contact Specific */}
                        {(type === 'Staff' || type === 'Contractors') && (
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>เบอร์โทร (Phone)</label>
                                <input
                                    type="text"
                                    value={formData.phone || ''}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                    placeholder="08x-xxx-xxxx"
                                />
                            </div>
                        )}

                    </div>

                    <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff',
                                color: '#64748b', fontWeight: 700, cursor: 'pointer'
                            }}
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            style={{
                                padding: '10px 24px', borderRadius: '12px', border: 'none', background: '#4f46e5',
                                color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                            }}
                        >
                            บันทึก
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MasterDataModal;
