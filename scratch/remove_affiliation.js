const fs = require('fs');

// 1. Remove Affiliation from AdminMasterData.tsx
const masterDataPath = 'd:\\Project_After Sale\\app\\src\\pages\\AdminMasterData.tsx';
let masterContent = fs.readFileSync(masterDataPath, 'utf8').replace(/\r\n/g, '\n');

// Targets to remove
const headerTarget = '{activeTab === \'Projects\' && <th style={{ padding: \'16px 32px\' }}>สังกัด (Affiliation)</th>}';
const cellTarget = `<td style={{ padding: '20px 32px', color: '#64748b', fontWeight: 600 }}>
                                                     {prj.affiliation || '-'}
                                                 </td>`;

if (masterContent.includes(headerTarget)) {
  masterContent = masterContent.replace(headerTarget, '');
  console.log("SUCCESS: Removed Affiliation header from AdminMasterData.tsx");
} else {
  console.error("WARNING: Header target not found in AdminMasterData.tsx");
}

const normCellTarget = cellTarget.replace(/\r\n/g, '\n');
if (masterContent.includes(normCellTarget)) {
  masterContent = masterContent.replace(normCellTarget, '');
  console.log("SUCCESS: Removed Affiliation cell from AdminMasterData.tsx");
} else {
  // Try regex for robust match
  const cellRegex = /<td style=\{\{\s*padding:\s*'20px 32px',\s*color:\s*'#64748b',\s*fontWeight:\s*600\s*\}\}>\s*\{\s*prj\.affiliation\s*\|\|\s*'-'\s*\}\s*<\/td>/;
  if (cellRegex.test(masterContent)) {
    masterContent = masterContent.replace(cellRegex, '');
    console.log("SUCCESS: Removed Affiliation cell from AdminMasterData.tsx via regex");
  } else {
    console.error("WARNING: Cell target not found in AdminMasterData.tsx");
  }
}

fs.writeFileSync(masterDataPath, masterContent.replace(/\n/g, '\r\n'), 'utf8');

// 2. Remove Affiliation from MasterDataModal.tsx
const modalPath = 'd:\\Project_After Sale\\app\\src\\components\\MasterDataModal.tsx';
let modalContent = fs.readFileSync(modalPath, 'utf8').replace(/\r\n/g, '\n');

const modalFieldTarget = `<div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>สังกัด (Affiliation)</label>
                                    <input
                                        type="text"
                                        value={formData.affiliation || ''}
                                        style={{ 
                                            width: '100%', padding: '10px 14px', borderRadius: '10px', 
                                            border: '1px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box',
                                            background: '#f1f5f9', cursor: 'not-allowed'
                                        }}
                                        placeholder="ยังไม่ได้ระบุ"
                                        disabled
                                    />
                                </div>`;

const normModalTarget = modalFieldTarget.replace(/\r\n/g, '\n');
if (modalContent.includes(normModalTarget)) {
  modalContent = modalContent.replace(normModalTarget, '');
  console.log("SUCCESS: Removed Affiliation field from MasterDataModal.tsx");
} else {
  console.error("WARNING: Affiliation field target not found in MasterDataModal.tsx");
}

fs.writeFileSync(modalPath, modalContent.replace(/\n/g, '\r\n'), 'utf8');
