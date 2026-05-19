const fs = require('fs');
const content = fs.readFileSync('d:\\Project_After Sale\\app\\src\\pages\\DailyReport.tsx', 'utf8');
const lines = content.split(/\r?\n/);
lines.forEach((line, idx) => {
  if (line.includes('setLabor(')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
