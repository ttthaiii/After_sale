const fs = require('fs');
const content = fs.readFileSync('d:\\Project_After Sale\\app\\src\\context\\WorkOrderContext.tsx', 'utf8');
const lines = content.split(/\r?\n/);
let foundIdx = -1;
lines.forEach((line, idx) => {
  if (line.includes('addTaskUpdate =') || line.includes('addTaskUpdate(')) {
    if (!line.includes('export') && !line.includes('addTaskUpdate,') && !line.includes('addTaskUpdate:')) {
      foundIdx = idx;
    }
  }
});
if (foundIdx !== -1) {
  const start = Math.max(0, foundIdx - 2);
  const end = Math.min(lines.length - 1, foundIdx + 30);
  for (let i = start; i <= end; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} else {
  console.log('Not found');
}
