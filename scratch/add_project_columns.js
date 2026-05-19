const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'AdminMasterData.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// The target code in AdminMasterData.tsx is:
// <td style={{ padding: '20px 32px' }}>
//     <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '6px 14px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800, fontFamily: 'monospace', border: '1px solid #c7d2fe' }}>
//         {prj.projectCode || prj.code}
//     </span>
// </td>

// Let's replace it by matching a unique substring and inserting the two new columns right after it!
const target = `{prj.projectCode || prj.code}\n\t\t\t\t\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\t\t\t</td>`;
const replacement = `{prj.projectCode || prj.code}\n\t\t\t\t\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\t\t\t</td>\n\t\t\t\t\t\t\t\t\t\t\t\t<td style={{ padding: '20px 32px' }}>\n\t\t\t\t\t\t\t\t\t\t\t\t\t<span style={{ background: '#f8fafc', color: '#475569', padding: '6px 14px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, border: '1px solid #e2e8f0' }}>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t{prj.affiliation || \'-\'}\n\t\t\t\t\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\t\t\t</td>\n\t\t\t\t\t\t\t\t\t\t\t\t<td style={{ padding: '20px 32px' }}>\n\t\t\t\t\t\t\t\t\t\t\t\t\t{(() => {\n\t\t\t\t\t\t\t\t\t\t\t\t\t\tconst statusText = prj.status || \'กำลังดำเนินการอยู่\';\n\t\t\t\t\t\t\t\t\t\t\t\t\t\tconst isOngoing = statusText === \'กำลังดำเนินการอยู่\';\n\t\t\t\t\t\t\t\t\t\t\t\t\t\treturn (\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<span style={{\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tbackground: isOngoing ? \'#dcfce7\' : \'#f1f5f9\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tcolor: isOngoing ? \'#15803d\' : \'#475569\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tpadding: \'6px 16px\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tborderRadius: \'20px\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tfontSize: \'0.85rem\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tfontWeight: 700,\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdisplay: \'inline-flex\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\talignItems: \'center\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tgap: \'6px\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tborder: isOngoing ? \'1px solid #bbf7d0\' : \'1px solid #e2e8f0\'\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<span style={{ width: \'6px\', height: \'6px\', borderRadius: \'50%\', background: isOngoing ? \'#16a34a\' : \'#64748b\' }}></span>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{statusText}\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t);\n\t\t\t\t\t\t\t\t\t\t\t\t\t})()}\n\t\t\t\t\t\t\t\t\t\t\t\t</td>`;

if (content.includes('{prj.projectCode || prj.code}')) {
  // Let's do a regex replacement that is whitespace-agnostic!
  const regex = /({prj\.projectCode\s*\|\|\s*prj\.code})([\s\S]*?<\/span>[\s\S]*?<\/td>)/;
  
  const match = content.match(regex);
  if (match) {
    console.log("Found match!");
    const matchedStr = match[0];
    const newStr = matchedStr + `\n\t\t\t\t\t\t\t\t\t\t\t\t<td style={{ padding: '20px 32px' }}>\n\t\t\t\t\t\t\t\t\t\t\t\t\t<span style={{ background: '#f8fafc', color: '#475569', padding: '6px 14px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, border: '1px solid #e2e8f0' }}>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t{prj.affiliation || \'-\'}\n\t\t\t\t\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\t\t\t</td>\n\t\t\t\t\t\t\t\t\t\t\t\t<td style={{ padding: '20px 32px' }}>\n\t\t\t\t\t\t\t\t\t\t\t\t\t{(() => {\n\t\t\t\t\t\t\t\t\t\t\t\t\t\tconst statusText = prj.status || \'กำลังดำเนินการอยู่\';\n\t\t\t\t\t\t\t\t\t\t\t\t\t\tconst isOngoing = statusText === \'กำลังดำเนินการอยู่\';\n\t\t\t\t\t\t\t\t\t\t\t\t\t\treturn (\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<span style={{\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tbackground: isOngoing ? \'#dcfce7\' : \'#f1f5f9\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tcolor: isOngoing ? \'#15803d\' : \'#475569\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tpadding: \'6px 16px\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tborderRadius: \'20px\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tfontSize: \'0.85rem\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tfontWeight: 700,\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdisplay: \'inline-flex\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\talignItems: \'center\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tgap: \'6px\',\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tborder: isOngoing ? \'1px solid #bbf7d0\' : \'1px solid #e2e8f0\'\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<span style={{ width: \'6px\', height: \'6px\', borderRadius: \'50%\', background: isOngoing ? \'#16a34a\' : \'#64748b\' }}></span>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t{statusText}\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t);\n\t\t\t\t\t\t\t\t\t\t\t\t\t})()}\n\t\t\t\t\t\t\t\t\t\t\t\t</td>`;
    content = content.replace(matchedStr, newStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully replaced and updated columns!");
  } else {
    console.log("Could not find regex match!");
  }
} else {
  console.log("Could not find target substring!");
}
