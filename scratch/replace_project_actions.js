const fs = require('fs');
const path = require('path');

const filePath = 'd:\\Project_After Sale\\app\\src\\pages\\AdminMasterData.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Target string to replace (ignoring extra space variance by using regex or direct match)
const target = `<td style={{ padding: '20px 32px', textAlign: 'right' }}>
                                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 800, fontStyle: 'italic', background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                        เชื่อมต่อระบบหลัก (Read-Only)
                                                    </span>
                                                </td>`;

const replacement = `<td style={{ padding: '20px 32px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 800, fontStyle: 'italic', background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                        เชื่อมต่อระบบหลัก
                                                    </span>
                                                    <button onClick={() => openEditModal(prj)} style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.85rem' }} onMouseOver={(e) => e.currentTarget.style.background = '#eef2ff'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                                                        <Edit2 size={16} /> แก้ไขรูปภาพ
                                                    </button>
                                                </td>`;

// Normalize newlines for a robust match
const normContent = content.replace(/\r\n/g, '\n');
const normTarget = target.replace(/\r\n/g, '\n');
const normReplacement = replacement.replace(/\r\n/g, '\n');

if (normContent.includes(normTarget)) {
  const updatedContent = normContent.replace(normTarget, normReplacement);
  // Write back with original windows ending style
  fs.writeFileSync(filePath, updatedContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log("SUCCESS: Replaced successfully!");
} else {
  // Let's try matching a simpler regex
  console.log("Target not found with exact space, trying dynamic spacing match...");
  const dynamicRegex = /<td style=\{\{\s*padding:\s*'20px 32px',\s*textAlign:\s*'right'\s*\}\}>\s*<span style=\{\{\s*color:\s*'#94a3b8'[^}]*\}\}>\s*เชื่อมต่อระบบหลัก\s*\(Read-Only\)\s*<\/span>\s*<\/td>/;
  
  if (dynamicRegex.test(normContent)) {
    const updatedContent = normContent.replace(dynamicRegex, normReplacement);
    fs.writeFileSync(filePath, updatedContent.replace(/\n/g, '\r\n'), 'utf8');
    console.log("SUCCESS: Replaced successfully via regex!");
  } else {
    console.error("ERROR: Target not found at all!");
  }
}
