const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== '.gemini') {
        searchDir(fullPath);
      }
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('addTaskUpdate')) {
          console.log(`Found in: ${fullPath}`);
        }
      }
    }
  }
}

searchDir('d:\\Project_After Sale\\app');
