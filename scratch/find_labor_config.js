const fs = require('fs');
const path = require('path');

const SEARCH_DIRS = [
  'D:\\',
  'C:\\Users\\101485'
];

const IGNORE_DIRS = [
  'node_modules',
  '.git',
  'AppData',
  'Local Settings',
  'Microsoft',
  'Templates',
  'Application Data'
];

function searchDir(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (IGNORE_DIRS.some(ignored => file.includes(ignored))) {
        continue;
      }
      
      const fullPath = path.join(dir, file);
      let stats;
      try {
        stats = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }
      
      if (stats.isDirectory()) {
        searchDir(fullPath);
      } else if (stats.isFile() && (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.json') || file.endsWith('.html') || file.endsWith('.env') || file.endsWith('.txt'))) {
        try {
          // Only read small files to prevent memory issues
          if (stats.size < 500000) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('labor-management-system-33b06') && content.includes('apiKey')) {
              console.log(`🎯 FOUND IT in file: ${fullPath}`);
              
              // Extract the config block
              const match = content.match(/\{[^}]*apiKey[^}]*\}/s) || content.match(/VITE_FIREBASE_API_KEY[^\n]*/g);
              if (match) {
                console.log("Config Details:", match[0]);
              }
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

console.log("Searching for Labor System Firebase Config...");
for (const searchDirRoot of SEARCH_DIRS) {
  console.log(`Searching directory: ${searchDirRoot}`);
  searchDir(searchDirRoot);
}
console.log("Search finished.");
