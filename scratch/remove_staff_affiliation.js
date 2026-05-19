const fs = require('fs');

// 1. Remove Staff Affiliation from AdminMasterData.tsx
const masterDataPath = 'd:\\Project_After Sale\\app\\src\\pages\\AdminMasterData.tsx';
let masterContent = fs.readFileSync(masterDataPath, 'utf8').replace(/\r\n/g, '\n');

// Target header to remove
const staffHeaderTarget = '<th style={{ padding: \'16px 32px\' }}>สังกัด</th>';
if (masterContent.includes(staffHeaderTarget)) {
  masterContent = masterContent.replace(staffHeaderTarget, '');
  console.log("SUCCESS: Removed Staff Affiliation header from AdminMasterData.tsx");
} else {
  console.error("WARNING: Staff Affiliation header not found in AdminMasterData.tsx");
}

// Target cell to remove
const staffCellTarget = '<td style={{ padding: \'20px 32px\', color: \'#64748b\' }}>{st.affiliation}</td>';
if (masterContent.includes(staffCellTarget)) {
  masterContent = masterContent.replace(staffCellTarget, '');
  console.log("SUCCESS: Removed Staff Affiliation cell from AdminMasterData.tsx");
} else {
  // Regex fallbacks
  const cellRegex = /<td style=\{\{\s*padding:\s*'20px 32px',\s*color:\s*'#64748b'\s*\}\}>\{\s*st\.affiliation\s*\}<\/td>/;
  if (cellRegex.test(masterContent)) {
    masterContent = masterContent.replace(cellRegex, '');
    console.log("SUCCESS: Removed Staff Affiliation cell from AdminMasterData.tsx via regex");
  } else {
    console.error("WARNING: Staff Affiliation cell not found in AdminMasterData.tsx");
  }
}

fs.writeFileSync(masterDataPath, masterContent.replace(/\n/g, '\r\n'), 'utf8');

// 2. Remove Staff Affiliation from MasterDataModal.tsx
const modalPath = 'd:\\Project_After Sale\\app\\src\\components\\MasterDataModal.tsx';
let modalContent = fs.readFileSync(modalPath, 'utf8').replace(/\r\n/g, '\n');

const staffFieldTarget = `<div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>สังกัด (Affiliation)</label>
                                    <input
                                        type="text"
                                        value={formData.affiliation || ''}
                                        onChange={(e) => handleChange('affiliation', e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                        placeholder="เช่น Sammakorn, Life Asset"
                                    />
                                </div>`;

const normFieldTarget = staffFieldTarget.replace(/\r\n/g, '\n');
if (modalContent.includes(normFieldTarget)) {
  modalContent = modalContent.replace(normFieldTarget, '');
  console.log("SUCCESS: Removed Staff Affiliation field from MasterDataModal.tsx");
} else {
  console.error("WARNING: Staff Affiliation field not found in MasterDataModal.tsx");
}

fs.writeFileSync(modalPath, modalContent.replace(/\n/g, '\r\n'), 'utf8');
