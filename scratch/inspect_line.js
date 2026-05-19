const fs = require('fs');
const content = fs.readFileSync('d:\\Project_After Sale\\app\\src\\components\\Sidebar.tsx', 'utf8');
const lines = content.split(/\r?\n/);
const line = lines[171]; // line 172 (0-indexed 171)
console.log("LINE CONTENT:", JSON.stringify(line));
console.log("CHAR CODES:", Array.from(line).map(c => c.charCodeAt(0)));
