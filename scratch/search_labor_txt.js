const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\101485\\Downloads\\Labor Dailyreport.txt', 'utf8');
const lines = content.split(/\r?\n/);
lines.forEach((line, idx) => {
  if (line.includes('การจัดการแรงงาน') || line.includes('Table') || line.includes('selectedWorkers.map') || line.includes('medCertFileUrl')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
