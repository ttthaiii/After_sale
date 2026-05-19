const fs = require('fs');

const path = 'd:\\Project_After Sale\\app\\src\\components\\Sidebar.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `const idMatch = (n.message || '').match(/WO-\\\d{4}-\\\d+/) || (n.title || '').match(/WO-\\\d{4}-\\\d+/);`;
const replacement = `const idMatch = (n.message || '').match(/[A-Za-z0-9]+-\\\d{4}-\\\d+(?:-WO)?/) || (n.title || '').match(/[A-Za-z0-9]+-\\\d{4}-\\\d+(?:-WO)?/);`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log("=== SUCCESS: Updated Sidebar.tsx regex! ===");
} else {
  console.log("=== ERROR: Target regex not found in Sidebar.tsx! ===");
}
