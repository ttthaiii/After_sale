const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\101485\\Downloads\\Labor Dailyreport.txt', 'utf8');
const lines = content.split(/\r?\n/);
let foundIdx = -1;
lines.forEach((line, idx) => {
  if (line.includes('medCertFileUrl') && line.includes('leaveType')) {
    foundIdx = idx;
  }
});
if (foundIdx !== -1) {
  const start = Math.max(0, foundIdx - 35);
  const end = Math.min(lines.length - 1, foundIdx + 20);
  for (let i = start; i <= end; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
